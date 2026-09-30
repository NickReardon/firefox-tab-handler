import assert from "node:assert/strict";
import test from "node:test";

import { applyOrganization, undoLastOrganization } from "../src/executor.js";
import { planOrganization } from "../src/planner.js";

test("applies and validates a plan before closing source windows", async () => {
  const snapshot = {
    focusedWindowId: 1,
    windows: [
      {
        id: 1,
        tabs: [
          { id: 10, windowId: 1, index: 0, active: true, pinned: true, groupId: -1 },
          { id: 11, windowId: 1, index: 1, pinned: false, groupId: -1 },
          { id: 12, windowId: 1, index: 2, pinned: false, groupId: 50 },
        ],
        groups: [{ id: 50, title: "Matched", color: "green", collapsed: true }],
      },
      {
        id: 2,
        tabs: [
          { id: 20, windowId: 2, index: 0, pinned: false, groupId: 30 },
          { id: 21, windowId: 2, index: 1, pinned: false, groupId: 30 },
          { id: 22, windowId: 2, index: 2, title: "Match", pinned: false, groupId: -1 },
          { id: 23, windowId: 2, index: 3, pinned: true, groupId: -1 },
          { id: 24, windowId: 2, index: 4, title: "Create", pinned: false, groupId: -1 },
        ],
        groups: [{ id: 30, title: "Matched", color: "blue", collapsed: true }],
      },
    ],
  };
  const plan = planOrganization(snapshot, [
    { id: "match", name: "Matched", color: "red", match: { titleIncludes: ["match"] } },
    { id: "create", name: "Created", color: "purple", match: { titleIncludes: ["create"] } },
  ]);
  const tabs = new Map(
    snapshot.windows.flatMap((window) => window.tabs).map((tab) => [tab.id, { ...tab }]),
  );
  const groups = new Map([
    [30, { id: 30, windowId: 2, title: "Matched", color: "blue", collapsed: true }],
    [50, { id: 50, windowId: 1, title: "Matched", color: "green", collapsed: true }],
  ]);
  const removedWindows = [];
  let storedSnapshot;
  let storedAnchorIds;
  let nextTabId = 100;
  const moveCalls = [];

  const api = {
    storage: {
      local: {
        get: async () => ({}),
        set: async (values) => {
          storedSnapshot = values.undoSnapshot ?? storedSnapshot;
          storedAnchorIds = values.undoAnchorIds ?? storedAnchorIds;
        },
      },
    },
    windows: {
      get: async (id) => ({ id, type: "normal", incognito: false }),
      remove: async (id) => { removedWindows.push(id); },
    },
    tabs: {
      query: async ({ windowId, pinned } = {}) => [...tabs.values()].filter(
        (tab) => (windowId === undefined || tab.windowId === windowId) &&
          (pinned === undefined || tab.pinned === pinned),
      ),
      create: async ({ windowId }) => {
        const tab = { id: nextTabId++, windowId, pinned: false, groupId: -1 };
        tabs.set(tab.id, tab);
        return tab;
      },
      move: async (tabId, { windowId, index }) => {
        moveCalls.push({ tabId, windowId, index });
        const destinationIndex = index === -1
          ? Math.max(-1, ...[...tabs.values()]
            .filter((tab) => tab.windowId === windowId)
            .map((tab) => tab.index)) + 1
          : index;
        tabs.set(tabId, { ...tabs.get(tabId), windowId, index: destinationIndex });
        return tabs.get(tabId);
      },
      group: async ({ tabIds, groupId = 40 }) => {
        if (!groups.has(groupId)) {
          groups.set(groupId, { id: groupId, windowId: 1, title: "", color: "grey", collapsed: false });
        }
        const previousGroupIds = new Set(tabIds.map((tabId) => tabs.get(tabId).groupId));
        for (const tabId of tabIds) {
          tabs.set(tabId, { ...tabs.get(tabId), groupId });
        }
        for (const previousGroupId of previousGroupIds) {
          if (
            previousGroupId !== -1 &&
            previousGroupId !== groupId &&
            ![...tabs.values()].some((tab) => tab.groupId === previousGroupId)
          ) {
            groups.delete(previousGroupId);
          }
        }
        return groupId;
      },
      update: async (tabId, changes) => {
        tabs.set(tabId, { ...tabs.get(tabId), ...changes });
        return tabs.get(tabId);
      },
    },
    tabGroups: {
      move: async (groupId, { windowId }) => {
        groups.set(groupId, { ...groups.get(groupId), windowId });
        for (const [tabId, tab] of tabs) {
          if (tab.groupId === groupId) {
            tabs.set(tabId, { ...tab, windowId });
          }
        }
        return groups.get(groupId);
      },
      update: async (groupId, changes) => {
        groups.set(groupId, { ...groups.get(groupId), ...changes });
        return groups.get(groupId);
      },
      get: async (groupId) => groups.get(groupId),
    },
  };

  const result = await applyOrganization(api, snapshot, plan);

  assert.equal(storedSnapshot, snapshot);
  assert.deepEqual(storedAnchorIds, [100]);
  assert.deepEqual(result, {
    movedGroups: 1,
    movedTabs: 3,
    createdGroups: 1,
    closedWindows: 1,
  });
  assert.deepEqual(removedWindows, [2]);
  assert.equal(tabs.get(23).pinned, true);
  assert.equal(tabs.get(23).groupId, -1);
  assert.equal(tabs.get(22).groupId, 50);
  assert.equal(tabs.get(20).groupId, 50);
  assert.equal(tabs.get(21).groupId, 50);
  assert.equal(tabs.get(24).groupId, 40);
  assert.equal(groups.has(30), false);
  assert.deepEqual(groups.get(50), {
    id: 50,
    windowId: 1,
    title: "Matched",
    color: "green",
    collapsed: true,
  });
  assert.deepEqual(moveCalls, [
    { tabId: 23, windowId: 1, index: 1 },
    { tabId: 22, windowId: 1, index: 6 },
    { tabId: 24, windowId: 1, index: 7 },
    { tabId: 11, windowId: 1, index: -1 },
  ]);
});

test("rejects a stale plan before mutation", async () => {
  let stored = false;
  const snapshot = {
    focusedWindowId: 1,
    windows: [{ id: 1, tabs: [{ id: 10, windowId: 1, groupId: -1 }], groups: [] }],
  };
  const api = {
    storage: {
      local: {
        get: async () => ({}),
        set: async () => { stored = true; },
      },
    },
    windows: { get: async () => ({ type: "normal", incognito: false }) },
    tabs: { query: async () => [] },
  };

  await assert.rejects(
    () => applyOrganization(api, snapshot, planOrganization(snapshot)),
    /changed after preview/,
  );
  assert.equal(stored, false);
});

test("undo recreates source windows and reports disappeared tabs", async () => {
  const snapshot = {
    focusedWindowId: 1,
    windows: [
      {
        id: 1,
        state: "normal",
        tabs: [
          { id: 10, windowId: 1, index: 0, active: true, pinned: true, groupId: -1 },
          { id: 12, windowId: 1, index: 1, pinned: false, groupId: 50 },
        ],
        groups: [{ id: 50, title: "Destination", color: "grey", collapsed: false }],
      },
      {
        id: 2,
        state: "normal",
        tabs: [
          { id: 20, windowId: 2, index: 0, active: true, pinned: false, groupId: 30 },
          { id: 21, windowId: 2, index: 1, pinned: false, groupId: 30 },
          { id: 22, windowId: 2, index: 2, pinned: false, groupId: -1 },
          { id: 23, windowId: 2, index: 3, pinned: true, groupId: -1 },
          { id: 24, windowId: 2, index: 4, pinned: false, groupId: 31 },
          { id: 25, windowId: 2, index: 5, pinned: false, groupId: 31 },
        ],
        groups: [
          { id: 30, title: "Existing", color: "blue", collapsed: true },
          { id: 31, title: "Merged", color: "yellow", collapsed: false },
        ],
      },
    ],
  };
  const tabs = new Map([
    [10, { ...snapshot.windows[0].tabs[0] }],
    [12, { ...snapshot.windows[0].tabs[1], groupId: 40 }],
    [20, { ...snapshot.windows[1].tabs[0], windowId: 1 }],
    [21, { ...snapshot.windows[1].tabs[1], windowId: 1 }],
    [22, { ...snapshot.windows[1].tabs[2], windowId: 1, groupId: 40 }],
    [24, { ...snapshot.windows[1].tabs[4], windowId: 1, groupId: 40 }],
    [25, { ...snapshot.windows[1].tabs[5], windowId: 1, groupId: 40 }],
  ]);
  const groups = new Map([
    [30, { id: 30, windowId: 1, title: "Existing", color: "blue", collapsed: true }],
    [40, { id: 40, windowId: 1, title: "Matched", color: "red", collapsed: false }],
    [50, { id: 50, windowId: 1, title: "Destination", color: "grey", collapsed: false }],
  ]);
  let removedUndo = false;
  let focusedWindowId;
  const movedGroupIds = [];

  const api = {
    storage: {
      local: {
        get: async () => ({ undoSnapshot: snapshot }),
        remove: async () => { removedUndo = true; },
      },
    },
    windows: {
      get: async (id) => {
        if (id !== 1) {
          throw new Error("missing");
        }
        return { id };
      },
      create: async () => {
        const anchor = { id: 100, windowId: 200, pinned: false, groupId: -1 };
        tabs.set(anchor.id, anchor);
        return { id: 200, tabs: [anchor] };
      },
      update: async (id) => { focusedWindowId = id; },
    },
    tabs: {
      get: async (id) => {
        if (!tabs.has(id)) {
          throw new Error("missing");
        }
        return tabs.get(id);
      },
      query: async ({ windowId, pinned } = {}) => [...tabs.values()].filter(
        (tab) => (windowId === undefined || tab.windowId === windowId) &&
          (pinned === undefined || tab.pinned === pinned),
      ),
      ungroup: async (id) => { tabs.set(id, { ...tabs.get(id), groupId: -1 }); },
      update: async (id, changes) => {
        if (!tabs.has(id)) {
          throw new Error("missing");
        }
        tabs.set(id, { ...tabs.get(id), ...changes });
      },
      move: async (id, { windowId }) => { tabs.set(id, { ...tabs.get(id), windowId }); },
      group: async ({ tabIds, groupId, createProperties }) => {
        const targetGroupId = groupId ?? 60;
        if (createProperties) {
          groups.set(targetGroupId, {
            id: targetGroupId,
            windowId: createProperties.windowId,
            title: "",
            color: "grey",
            collapsed: false,
          });
        }
        for (const tabId of tabIds) {
          tabs.set(tabId, { ...tabs.get(tabId), groupId: targetGroupId });
        }
        return targetGroupId;
      },
      remove: async (id) => { tabs.delete(id); },
    },
    tabGroups: {
      query: async () => [...groups.values()],
      move: async (id, { windowId }) => {
        movedGroupIds.push(id);
        groups.set(id, { ...groups.get(id), windowId });
        for (const [tabId, tab] of tabs) {
          if (tab.groupId === id) {
            tabs.set(tabId, { ...tab, windowId });
          }
        }
      },
      update: async (id, changes) => { groups.set(id, { ...groups.get(id), ...changes }); },
    },
  };

  const result = await undoLastOrganization(api);

  assert.equal(result.restoredTabs, 1);
  assert.equal(result.restoredGroups, 3);
  assert.equal(result.unchangedTabs, 1);
  assert.equal(result.unchangedGroups, 0);
  assert.match(result.warnings.join("\n"), /Tab 23 disappeared/);
  assert.equal(tabs.get(22).windowId, 200);
  assert.equal(tabs.get(22).groupId, -1);
  assert.equal(tabs.get(12).groupId, 50);
  assert.equal(groups.get(30).windowId, 200);
  assert.deepEqual(groups.get(60), {
    id: 60,
    windowId: 200,
    title: "Merged",
    color: "yellow",
    collapsed: false,
  });
  assert.deepEqual(movedGroupIds, [30]);
  assert.equal(focusedWindowId, 1);
  assert.equal(removedUndo, true);
});
