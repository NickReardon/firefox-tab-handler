import assert from "node:assert/strict";
import test from "node:test";

import { matchesRule, planOrganization } from "../src/planner.js";

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

test("an excluded tab falls through to the next matching rule", () => {
  const gmail = {
    url: "https://mail.google.com/mail/u/0/",
    title: "Unreal Engine newsletter",
  };
  const unreal = {
    id: "unreal",
    name: "Development",
    color: "green",
    match: { titleIncludes: ["unreal engine"] },
    exclude: { hostnames: ["mail.google.com"] },
  };
  const mail = {
    id: "mail",
    name: "Communication",
    color: "cyan",
    match: { hostnames: ["mail.google.com"] },
  };

  assert.equal(matchesRule(unreal, gmail), false);
  assert.equal(matchesRule(unreal, { ...gmail, url: "https://www.youtube.com/" }), true);
  assert.equal(matchesRule({ ...unreal, exclude: {} }, gmail), true);
  assert.equal([unreal, mail].find((rule) => matchesRule(rule, gmail)), mail);
});

test("scoped planning can select a later matching rule", () => {
  const plan = planOrganization(snapshot, rules, {
    tabIds: [22],
    ruleId: "epic",
  });

  assert.deepEqual(plan.newGroups.map(({ ruleId, tabMoves }) => [
    ruleId,
    tabMoves.map(({ tabId }) => tabId),
  ]), [["epic", [22]]]);
  assert.throws(
    () => planOrganization(snapshot, rules, { tabIds: [22], ruleId: "missing" }),
    /no longer available/,
  );
  assert.throws(
    () => planOrganization(snapshot, rules, { tabIds: [11], ruleId: "epic" }),
    /no longer matches/,
  );
});

test("explicit scoped rules can move a tab out of an existing group", () => {
  const plan = planOrganization(snapshot, rules, {
    tabIds: [20],
    ruleId: "epic",
  });

  assert.deepEqual(plan.preservedGroups, []);
  assert.deepEqual(plan.newGroups[0].tabMoves.map(({ tabId }) => tabId), [20]);
});

test("limits a plan to selected tabs while retaining its destination window", () => {
  const plan = planOrganization(snapshot, rules, { tabIds: [11, 23] });

  assert.equal(plan.destinationWindowId, 1);
  assert.deepEqual(plan.looseTabMoves.map(({ tabId }) => tabId), [11]);
  assert.deepEqual(
    plan.newGroups.flatMap((group) => group.tabMoves.map(({ tabId }) => tabId)),
    [23],
  );
  assert.deepEqual(plan.preservedGroups, []);
});

test("scoped planning reuses one unselected group without merging its peers", () => {
  const scopedSnapshot = structuredClone(snapshot);
  scopedSnapshot.windows[0].tabs.push(
    { id: 12, windowId: 1, index: 2, title: "Existing", groupId: 40 },
    { id: 13, windowId: 1, index: 3, title: "Existing", groupId: 41 },
    { id: 14, windowId: 1, index: 4, title: "Tethered issue", groupId: -1 },
  );
  scopedSnapshot.windows[0].groups.push(
    { id: 40, title: "Tethered", color: "green", collapsed: false },
    { id: 41, title: "Tethered", color: "yellow", collapsed: false },
  );

  const plan = planOrganization(scopedSnapshot, rules, { tabIds: [14] });

  assert.equal(plan.newGroups[0].targetGroupId, 40);
  assert.equal(plan.newGroups[0].mergeGroupIds, undefined);
  assert.deepEqual(plan.preservedGroups, []);
});

test("targets an existing destination group with the exact rule name", () => {
  const matchingSnapshot = structuredClone(snapshot);
  matchingSnapshot.windows[0].tabs.push({
    id: 12,
    windowId: 1,
    index: 2,
    title: "Existing target",
    url: "about:blank",
    groupId: 40,
  });
  matchingSnapshot.windows[0].groups = [
    { id: 40, title: "Tethered", color: "green", collapsed: true },
  ];
  matchingSnapshot.windows[1].tabs.push({
    id: 24,
    windowId: 2,
    index: 4,
    title: "Existing source target",
    url: "about:blank",
    groupId: 41,
  });
  matchingSnapshot.windows[1].groups.push(
    { id: 41, title: "Tethered", color: "yellow", collapsed: false },
  );

  const plan = planOrganization(matchingSnapshot, rules);

  assert.equal(plan.newGroups[0].targetGroupId, 40);
  assert.deepEqual(plan.newGroups[0].mergeGroupIds, [41]);
  assert.equal(plan.newGroups[0].mergeTabCount, 1);
  assert.equal(plan.newGroups[0].color, "red");
  assert.equal(plan.newGroups[1].targetGroupId, undefined);
});

test("possible-match rules never sort automatically but can be chosen explicitly", () => {
  const possible = {
    id: "maybe-tethered",
    name: "Tethered",
    color: "red",
    manualOnly: true,
    match: { hostnames: ["dev.epicgames.com"] },
  };
  const withPossible = [possible, ...rules];

  const plan = planOrganization(snapshot, withPossible, { tabIds: [23] });
  assert.deepEqual(plan.newGroups.map(({ ruleId }) => ruleId), ["epic"]);

  const onlyPossible = planOrganization(snapshot, [possible], { tabIds: [23] });
  assert.deepEqual(onlyPossible.newGroups, []);
  assert.deepEqual(onlyPossible.looseTabMoves.map(({ tabId }) => tabId), [23]);

  const explicit = planOrganization(snapshot, withPossible, {
    tabIds: [23],
    ruleId: "maybe-tethered",
  });
  assert.deepEqual(explicit.newGroups.map(({ title, tabMoves }) => [
    title,
    tabMoves.map(({ tabId }) => tabId),
  ]), [["Tethered", [23]]]);
});

test("scoped planning accepts tabs matching any same-name rule", () => {
  const possible = {
    id: "maybe-tethered",
    name: "Tethered",
    color: "red",
    manualOnly: true,
    match: { hostnames: ["dev.epicgames.com"] },
  };

  const plan = planOrganization(snapshot, [...rules, possible], {
    tabIds: [22, 23],
    ruleId: "tethered",
  });

  assert.deepEqual(
    plan.newGroups[0].tabMoves.map(({ tabId }) => tabId),
    [22, 23],
  );
});

test("possible-match rule names still merge duplicate groups", () => {
  const mergeSnapshot = structuredClone(snapshot);
  mergeSnapshot.windows[0].tabs.push(
    { id: 12, windowId: 1, index: 2, title: "One", url: "about:blank", groupId: 40 },
    { id: 13, windowId: 1, index: 3, title: "Two", url: "about:blank", groupId: 41 },
  );
  mergeSnapshot.windows[0].groups.push(
    { id: 40, title: "Gaming", color: "green", collapsed: false },
    { id: 41, title: "Gaming", color: "yellow", collapsed: false },
  );

  const plan = planOrganization(mergeSnapshot, [{
    id: "maybe-gaming",
    name: "Gaming",
    color: "green",
    manualOnly: true,
    match: { hostnames: ["www.youtube.com"] },
  }]);

  assert.deepEqual(plan.newGroups.map(({ targetGroupId, mergeGroupIds, tabMoves }) => [
    targetGroupId,
    mergeGroupIds,
    tabMoves.length,
  ]), [[40, [41], 0]]);
});

test("rejects a snapshot without an eligible focused destination", () => {
  assert.throws(
    () => planOrganization({ ...snapshot, focusedWindowId: 4 }, rules),
    /No eligible focused destination window/,
  );
});
