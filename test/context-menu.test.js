import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTEXT_FULL_PREVIEW_MENU_ID,
  CONTEXT_AUTO_SORT_MENU_ID,
  handleContextMenuClick,
  refreshContextMenu,
  registerContextMenu,
} from "../src/context-menu.js";

const rules = [
  {
    id: "work",
    name: "Work",
    color: "blue",
    match: { hostnames: ["example.com"] },
  },
  {
    id: "docs",
    name: "Docs",
    color: "green",
    match: { titleIncludes: ["docs"] },
  },
];

function contextApi({
  tabs = [],
  groups = [],
  openPopup = async () => {},
} = {}) {
  const calls = [];
  const api = {
    action: { openPopup },
    tabs: { query: async () => tabs },
    tabGroups: { query: async () => groups },
    storage: {
      local: { get: async () => ({ rules }) },
    },
    menus: {
      create: (details) => calls.push(["create", details]),
      refresh: async () => calls.push(["refresh"]),
      remove: async (id) => calls.push(["remove", id]),
      removeAll: async () => calls.push(["removeAll"]),
      update: async (id, details) => calls.push(["update", id, details]),
    },
  };

  return { api, calls };
}

test("registers every action at the top level of the tab menu", async () => {
  const { api, calls } = contextApi();

  await registerContextMenu(api);

  assert.deepEqual(calls[0], ["removeAll"]);
  assert.deepEqual(calls[1], ["create", {
    id: CONTEXT_FULL_PREVIEW_MENU_ID,
    title: "Preview full plan",
    contexts: ["tab"],
  }]);
  assert.equal(calls.filter(([type]) => type === "create").length, 5);
  assert.ok(calls.filter(([type]) => type === "create")
    .every(([, details]) => details.parentId === undefined));
});

test("shows all matching rules for one tab", async () => {
  const tab = {
    id: 1,
    windowId: 4,
    highlighted: false,
    pinned: false,
    groupId: -1,
    url: "https://example.com/guide",
    title: "Docs guide",
  };
  const { api, calls } = contextApi({ tabs: [tab] });
  await registerContextMenu(api);
  calls.length = 0;

  await refreshContextMenu(api, tab);

  assert.ok(calls.some((call) => call[0] === "update" &&
    call[1] === CONTEXT_AUTO_SORT_MENU_ID &&
    call[2].title === "Auto-sort into Work"));
  assert.deepEqual(
    calls.filter(([type]) => type === "create")
      .map(([, details]) => [details.title, details.icons]),
    [
      ["Move tab into Work", { 16: "icons/groups/blue.svg" }],
      ["Move tab into Docs", { 16: "icons/groups/green.svg" }],
    ],
  );
});

test("offers a grouped tab only its other matching groups", async () => {
  const tab = {
    id: 1,
    windowId: 4,
    highlighted: false,
    pinned: false,
    groupId: 40,
    url: "https://example.com/guide",
    title: "Docs guide",
  };
  const { api, calls } = contextApi({
    tabs: [tab],
    groups: [{ id: 40, title: "Work" }],
  });
  await registerContextMenu(api);
  calls.length = 0;

  await refreshContextMenu(api, tab);

  assert.deepEqual(
    calls.filter(([type]) => type === "create")
      .map(([, details]) => details.title),
    ["Move tab into Docs"],
  );
  assert.ok(calls.some((call) => call[0] === "update" &&
    call[1] === CONTEXT_AUTO_SORT_MENU_ID && call[2].visible === false));
});

test("counts overlapping matches and unmatched tabs for a selection", async () => {
  const tabs = [
    {
      id: 1,
      windowId: 4,
      highlighted: true,
      pinned: false,
      groupId: -1,
      url: "https://example.com/guide",
      title: "Docs guide",
    },
    {
      id: 2,
      windowId: 4,
      highlighted: true,
      pinned: false,
      groupId: -1,
      url: "https://example.com/other",
      title: "Other",
    },
    {
      id: 3,
      windowId: 4,
      highlighted: true,
      pinned: false,
      groupId: -1,
      url: "https://unmatched.test",
      title: "Other",
    },
  ];
  const { api, calls } = contextApi({ tabs });
  await registerContextMenu(api);
  calls.length = 0;

  await refreshContextMenu(api, tabs[0]);

  assert.deepEqual(
    calls.filter(([type]) => type === "create")
      .map(([, details]) => details.title),
    ["Move 2 matching tabs into Work", "Move 1 matching tab into Docs"],
  );
});

test("directly applies auto-sort and explicit group actions", async () => {
  const tabs = [
    {
      id: 1,
      windowId: 4,
      highlighted: true,
      pinned: false,
      groupId: -1,
      url: "https://example.com/guide",
      title: "Docs guide",
    },
    {
      id: 2,
      windowId: 4,
      highlighted: true,
      pinned: false,
      groupId: 40,
      url: "https://example.com/other",
      title: "Other",
    },
  ];
  const groups = [{ id: 40, title: "Work" }];
  const auto = contextApi({
    tabs,
    groups,
    openPopup: async () => assert.fail("auto-sort must not open the popup"),
  });
  let autoScope;
  assert.deepEqual(
    await handleContextMenuClick(
      auto.api,
      { menuItemId: CONTEXT_AUTO_SORT_MENU_ID },
      tabs[0],
      async (scope) => {
        autoScope = scope;
        return { applied: true };
      },
    ),
    { applied: true },
  );
  assert.deepEqual(autoScope, { windowId: 4, tabIds: [1] });

  const explicit = contextApi({
    tabs,
    groups,
    openPopup: async () => assert.fail("explicit group actions must not open the popup"),
  });
  let appliedScope;
  assert.deepEqual(
    await handleContextMenuClick(
      explicit.api,
      { menuItemId: "sort-matching-rule:docs" },
      tabs[0],
      async (scope) => {
        appliedScope = scope;
        return { applied: true };
      },
    ),
    { applied: true },
  );
  assert.deepEqual(appliedScope, {
    windowId: 4,
    tabIds: [1],
    ruleId: "docs",
  });
});

test("opens only the full plan in the toolbar popup", async () => {
  const tab = {
    id: 1,
    windowId: 4,
    highlighted: false,
    pinned: false,
    groupId: -1,
    url: "https://example.com",
    title: "Work",
  };
  let popupOpened = false;
  const full = contextApi({
    tabs: [tab],
    openPopup: async () => { popupOpened = true; },
  });
  await handleContextMenuClick(
    full.api,
    { menuItemId: CONTEXT_FULL_PREVIEW_MENU_ID },
    tab,
  );
  assert.equal(popupOpened, true);
});
