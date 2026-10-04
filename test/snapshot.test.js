import assert from "node:assert/strict";
import test from "node:test";

import { snapshotBrowser } from "../src/snapshot.js";

test("snapshots eligible windows and their native groups", async () => {
  const snapshot = await snapshotBrowser({
    windows: {
      getLastFocused: async () => ({ id: 1, type: "normal" }),
      getAll: async () => [
        {
          id: 1,
          type: "normal",
          focused: false,
          incognito: false,
          state: "normal",
          tabs: [
            {
              id: 10,
              index: 0,
              title: "Example",
              url: "https://example.com",
              pinned: false,
              active: true,
              discarded: false,
              cookieStoreId: "firefox-default",
              groupId: -1,
            },
          ],
        },
        { id: 2, type: "normal", focused: true, incognito: true, tabs: [] },
      ],
    },
    tabGroups: {
      query: async () => [
        { id: 20, windowId: 1, title: "Work", color: "blue", collapsed: false },
        { id: 21, windowId: 2, title: "Private", color: "grey", collapsed: false },
      ],
    },
  });

  assert.equal(snapshot.focusedWindowId, 1);
  assert.deepEqual(snapshot.windows.map(({ id }) => id), [1]);
  assert.deepEqual(snapshot.windows[0].groups.map(({ id }) => id), [20]);
  assert.equal(snapshot.windows[0].tabs[0].cookieStoreId, "firefox-default");
});
