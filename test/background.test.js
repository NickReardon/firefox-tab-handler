import assert from "node:assert/strict";
import test from "node:test";

globalThis.browser = { runtime: { onMessage: { addListener() {} } } };

const { handleBackgroundMessage } = await import("../src/background.js");

test("builds a preview without exposing mutation messages", async () => {
  const tab = { id: 10, windowId: 1, index: 0, active: true, pinned: false, groupId: -1 };
  const stored = {};
  const api = {
    storage: {
      local: {
        set: async (values) => Object.assign(stored, values),
        get: async () => stored,
      },
    },
    windows: {
      getAll: async () => [
        {
          id: 1,
          focused: true,
          incognito: false,
          tabs: [tab],
        },
      ],
      getLastFocused: async () => ({ id: 1 }),
      get: async () => ({ id: 1, type: "normal", incognito: false }),
    },
    tabs: {
      query: async () => [tab],
      update: async (id, changes) => Object.assign(tab, changes),
      move: () => assert.fail("preview must not move tabs"),
      group: () => assert.fail("preview must not group tabs"),
    },
    tabGroups: {
      query: async () => [],
      move: () => assert.fail("preview must not move groups"),
    },
  };

  const plan = await handleBackgroundMessage(api, { type: "planner:preview" });

  assert.equal(plan.destinationWindowId, 1);
  assert.equal(plan.activeTabId, 10);
  stored.rules = [{
    id: "tab",
    name: "Matched",
    color: "blue",
    match: { hostnames: [], urlIncludes: [], titleIncludes: ["tab"] },
  }];
  tab.title = "Matched tab";
  assert.deepEqual(
    (await handleBackgroundMessage(api, { type: "planner:preview" })).newGroups
      .map(({ ruleId }) => ruleId),
    ["tab"],
  );
  delete stored.rules;
  delete tab.title;
  assert.deepEqual(
    await handleBackgroundMessage(api, { type: "planner:apply", plan }),
    { movedGroups: 0, movedTabs: 0, createdGroups: 0, closedWindows: 0 },
  );
  assert.equal(
    await handleBackgroundMessage(api, { type: "planner:undo-available" }),
    true,
  );
  assert.equal(await handleBackgroundMessage(api, { type: "logging:get" }), false);
  assert.equal(
    await handleBackgroundMessage(api, { type: "logging:set", enabled: true }),
    true,
  );
  assert.equal(await handleBackgroundMessage(api, { type: "logging:get" }), true);
  assert.equal(
    handleBackgroundMessage(api, { type: "spike:move-loose-tab" }),
    undefined,
  );
  assert.equal(handleBackgroundMessage(api, { type: "unknown" }), undefined);
});
