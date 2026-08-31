import assert from "node:assert/strict";
import test from "node:test";

import { planOrganization } from "../src/planner.js";

const snapshot = {
  focusedWindowId: 1,
  windows: [
    {
      id: 1,
      type: "normal",
      focused: true,
      tabs: [
        { id: 10, windowId: 1, index: 0, active: true, pinned: true, groupId: -1 },
        { id: 11, windowId: 1, index: 1, title: "Keep loose", url: "about:newtab", groupId: -1 },
      ],
      groups: [],
    },
    {
      id: 2,
      type: "normal",
      tabs: [
        { id: 20, windowId: 2, index: 0, active: true, title: "Docs", url: "https://dev.epicgames.com/docs", groupId: 30 },
        { id: 21, windowId: 2, index: 1, title: "Forum", url: "https://forums.unrealengine.com", groupId: 30 },
        { id: 22, windowId: 2, index: 2, title: "Tethered issue", url: "https://github.com/example", groupId: -1 },
        { id: 23, windowId: 2, index: 3, title: "Epic docs", url: "https://dev.epicgames.com/community", groupId: -1 },
      ],
      groups: [{ id: 30, title: "Existing", color: "blue", collapsed: true }],
    },
    {
      id: 3,
      type: "popup",
      tabs: [{ id: 31, active: true, pinned: false, groupId: -1 }],
      groups: [],
    },
    {
      id: 4,
      type: "normal",
      incognito: true,
      tabs: [{ id: 41, active: true, pinned: false, groupId: -1 }],
      groups: [],
    },
  ],
};

const rules = [
  {
    id: "tethered",
    name: "Tethered",
    color: "red",
    match: { titleIncludes: ["tethered"] },
  },
  {
    id: "epic",
    name: "Epic",
    color: "blue",
    match: {
      hostnames: ["dev.epicgames.com"],
      urlIncludes: ["github.com"],
      titleIncludes: ["docs"],
    },
  },
];

test("plans every eligible tab exactly once while preserving safety invariants", () => {
  const plan = planOrganization(snapshot, rules);

  assert.equal(plan.destinationWindowId, 1);
  assert.equal(plan.activeTabId, 10);
  assert.deepEqual(plan.preservedGroups, [
    {
      id: 30,
      title: "Existing",
      color: "blue",
      collapsed: true,
      sourceWindowId: 2,
      destinationWindowId: 1,
      sourceIndex: 0,
      requiresMove: true,
      tabIds: [20, 21],
    },
  ]);
  assert.deepEqual(plan.looseTabMoves, [
    { tabId: 10, title: "Untitled tab", sourceWindowId: 1, destinationWindowId: 1, sourceIndex: 0, requiresMove: false, pinned: true },
    { tabId: 11, title: "Keep loose", sourceWindowId: 1, destinationWindowId: 1, sourceIndex: 1, requiresMove: false, pinned: false },
  ]);
  assert.deepEqual(plan.newGroups, [
    {
      ruleId: "tethered",
      title: "Tethered",
      color: "red",
      tabMoves: [{ tabId: 22, title: "Tethered issue", sourceWindowId: 2, destinationWindowId: 1, sourceIndex: 2, requiresMove: true, pinned: false }],
    },
    {
      ruleId: "epic",
      title: "Epic",
      color: "blue",
      tabMoves: [{ tabId: 23, title: "Epic docs", sourceWindowId: 2, destinationWindowId: 1, sourceIndex: 3, requiresMove: true, pinned: false }],
    },
  ]);

  const represented = [
    ...plan.preservedGroups.flatMap((group) => group.tabIds),
    ...plan.looseTabMoves.map((move) => move.tabId),
    ...plan.newGroups.flatMap((group) => group.tabMoves.map((move) => move.tabId)),
  ];
  assert.deepEqual(represented.sort((left, right) => left - right), [10, 11, 20, 21, 22, 23]);
  assert.equal(new Set(represented).size, represented.length);
  assert.equal(plan.warnings.length, 0);
});

test("uses the first matching rule", () => {
  const plan = planOrganization(snapshot, [rules[1], rules[0]]);

  assert.deepEqual(plan.newGroups.map(({ ruleId, tabMoves }) => [ruleId, tabMoves.map(({ tabId }) => tabId)]), [
    ["epic", [22, 23]],
  ]);
});

test("rejects a snapshot without an eligible focused destination", () => {
  assert.throws(
    () => planOrganization({ ...snapshot, focusedWindowId: 4 }, rules),
    /No eligible focused destination window/,
  );
});
