import assert from "node:assert/strict";
import test from "node:test";

import { itemLabel } from "../src/popup.js";

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
});
