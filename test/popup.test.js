import assert from "node:assert/strict";
import test from "node:test";

import { itemLabel, summarizePlan } from "../src/popup.js";

test("labels preview items as moves or keeps with useful tab state", () => {
  assert.equal(
    itemLabel({
      tabId: 11,
      title: "Example",
      sourceWindowId: 21,
      destinationWindowId: 21,
      requiresMove: false,
      pinned: true,
    }),
    "Keep - Example - Tab 11 - From window 21 - To window 21 - Pinned",
  );
  assert.equal(
    itemLabel({
      id: 30,
      title: "",
      sourceWindowId: 2,
      destinationWindowId: 1,
      requiresMove: true,
      tabIds: [20, 21],
      color: "blue",
      collapsed: true,
    }),
    "Move - Untitled group - ID 30 - From window 2 - To window 1 - 2 tabs - Color blue - Collapsed",
  );
  assert.equal(
    itemLabel({
      title: "Matched",
      color: "red",
      targetGroupId: 50,
      mergeGroupIds: [30],
      mergeTabCount: 2,
      tabMoves: [{ tabId: 22 }],
    }),
    "Matched - 3 tabs - Color red - Join group 50 - Merge groups 30",
  );
});

test("summarizes each preview category without exposing its details", () => {
  assert.deepEqual(
    summarizePlan({
      preservedGroups: [{ id: 1 }],
      looseTabMoves: [{ tabId: 2 }, { tabId: 3 }],
      newGroups: [{ title: "Docs" }],
      warnings: [],
    }),
    { preservedGroups: 1, looseTabs: 2, ruleGroups: 1, warnings: 0 },
  );
  assert.deepEqual(summarizePlan({}), {
    preservedGroups: 0,
    looseTabs: 0,
    ruleGroups: 0,
    warnings: 0,
  });
});
