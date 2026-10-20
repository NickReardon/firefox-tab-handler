import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTEXT_FULL_PREVIEW_MENU_ID,
  CONTEXT_AUTO_SORT_MENU_ID,
  CONTEXT_NO_MATCH_MENU_ID,
  CONTEXT_OTHER_GROUPS_MENU_ID,
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

const possibleRules = [
  ...rules,
  {
    id: "maybe-media",
    name: "Media",
    color: "red",
    manualOnly: true,
    match: { hostnames: ["example.com"] },
  },
  {
    id: "maybe-work",
    name: "Work",
    color: "blue",
    manualOnly: true,
    match: { titleIncludes: ["meeting"] },
  },
];

function looseTab(id, overrides = {}) {
  return {
    id,
    windowId: 4,
    highlighted: false,
    pinned: false,
    groupId: -1,
    url: "https://example.com/guide",
    title: "Docs guide",
    ...overrides,
  };
}

function createdTitles(calls) {
  return calls.filter(([type]) => type === "create").map(([, details]) => details.title);
}

function lastUpdate(calls, id) {
  return calls.filter((call) => call[0] === "update" && call[1] === id).at(-1)?.[2];
}

function contextApi({
  tabs = [],
  groups = [],
  rules: storedRules = rules,
  openPopup = async () => {},
} = {}) {
  const calls = [];
  const api = {
    action: { openPopup },
    tabs: { query: async () => tabs },
    tabGroups: { query: async () => groups },
    storage: {
      local: { get: async () => ({ rules: storedRules }) },
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
  assert.equal(calls.filter(([type]) => type === "create").length, 6);
  assert.ok(calls.filter(([type]) => type === "create")
    .every(([, details]) => details.parentId === undefined));
});

test("offers other matching groups for one tab without repeating auto-sort", async () => {
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
    [["Move tab into Docs", { 16: "icons/groups/green.svg" }]],
  );
  assert.equal(lastUpdate(calls, CONTEXT_OTHER_GROUPS_MENU_ID).visible, true);
  assert.equal(lastUpdate(calls, CONTEXT_NO_MATCH_MENU_ID).visible, false);
});

test("hides other groups when auto-sort covers the only match", async () => {
  const tab = looseTab(1, { title: "Guide" });
  const { api, calls } = contextApi({ tabs: [tab] });
  await registerContextMenu(api);
  calls.length = 0;

  await refreshContextMenu(api, tab);

  assert.deepEqual(createdTitles(calls), []);
  assert.equal(lastUpdate(calls, CONTEXT_AUTO_SORT_MENU_ID).title, "Auto-sort into Work");
  assert.equal(lastUpdate(calls, CONTEXT_OTHER_GROUPS_MENU_ID).visible, false);
  assert.equal(lastUpdate(calls, CONTEXT_NO_MATCH_MENU_ID).visible, false);
});

test("lists possible-match groups after normal matches and never auto-sorts into them", async () => {
  const tab = looseTab(1, { url: "https://unmatched.test", title: "Docs meeting" });
  const { api, calls } = contextApi({ tabs: [tab], rules: possibleRules });
  await registerContextMenu(api);
  calls.length = 0;

  await refreshContextMenu(api, tab);

  assert.equal(lastUpdate(calls, CONTEXT_AUTO_SORT_MENU_ID).title, "Auto-sort into Docs");
  assert.deepEqual(createdTitles(calls), ["Move tab into Work"]);

  const possibleOnly = looseTab(2, { title: "Guide" });
  const { api: onlyApi, calls: onlyCalls } = contextApi({
    tabs: [possibleOnly],
    rules: [possibleRules[2]],
  });
  await registerContextMenu(onlyApi);
  onlyCalls.length = 0;

  await refreshContextMenu(onlyApi, possibleOnly);

  assert.equal(lastUpdate(onlyCalls, CONTEXT_AUTO_SORT_MENU_ID).visible, false);
  assert.deepEqual(createdTitles(onlyCalls), ["Move tab into Media"]);
});

test("orders normal matches before possible matches with one entry per group", async () => {
  const tab = looseTab(1, { groupId: 40 });
  const { api, calls } = contextApi({
    tabs: [tab],
    groups: [{ id: 40, title: "Other" }],
    rules: [possibleRules[2], ...possibleRules.slice(0, 2), possibleRules[3]],
  });
  await registerContextMenu(api);
  calls.length = 0;

  await refreshContextMenu(api, tab);

  assert.deepEqual(createdTitles(calls), [
    "Move tab into Work",
    "Move tab into Docs",
    "Move tab into Media",
  ]);
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

  assert.deepEqual(createdTitles(calls), ["Move 1 matching tab into Docs"]);
  assert.equal(
    lastUpdate(calls, CONTEXT_AUTO_SORT_MENU_ID).title,
    "Auto-sort 2 tabs into Work",
  );
});

test("names up to two auto-sort groups for a selection", async () => {
  const tabs = [
    looseTab(1, { highlighted: true, url: "https://a.test", title: "Docs" }),
    looseTab(2, { highlighted: true }),
    looseTab(3, { highlighted: true, url: "https://b.test", title: "Meeting" }),
  ];
  const { api, calls } = contextApi({
    tabs,
    rules: [...rules, { ...possibleRules[3], id: "meetings", name: "Meetings", manualOnly: false }],
  });
  await registerContextMenu(api);
  calls.length = 0;

  await refreshContextMenu(api, tabs[0]);

  assert.equal(
    lastUpdate(calls, CONTEXT_AUTO_SORT_MENU_ID).title,
    "Auto-sort 3 tabs into Docs, Work +1",
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

test("auto-sort skips possible matches and explicit moves include same-name rules", async () => {
  const tabs = [
    looseTab(1, { highlighted: true, url: "https://unmatched.test", title: "Meeting" }),
    looseTab(2, { highlighted: true, url: "https://example.com/a", title: "A" }),
  ];
  const auto = contextApi({ tabs, rules: [possibleRules[3]] });
  let autoScope;
  assert.equal(
    await handleContextMenuClick(
      auto.api,
      { menuItemId: CONTEXT_AUTO_SORT_MENU_ID },
      tabs[0],
      async (scope) => { autoScope = scope; },
    ),
    undefined,
  );
  assert.equal(autoScope, undefined);

  const explicit = contextApi({ tabs, rules: possibleRules });
  let appliedScope;
  await handleContextMenuClick(
    explicit.api,
    { menuItemId: "sort-matching-rule:work" },
    tabs[0],
    async (scope) => { appliedScope = scope; },
  );
  assert.deepEqual(appliedScope, { windowId: 4, tabIds: [1, 2], ruleId: "work" });
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
