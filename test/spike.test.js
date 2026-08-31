import assert from "node:assert/strict";
import test from "node:test";

import {
  handleSpikeMessage,
  moveExistingGroup,
  moveLooseTab,
  snapshotBrowser,
} from "../src/spike.js";

test("routes spike messages", async () => {
  const api = {
    windows: {
      getAll: async () => [],
      getLastFocused: async () => ({ id: 99, type: "devtools" }),
    },
    tabGroups: { query: async () => [] },
  };

  const snapshot = await handleSpikeMessage(api, { type: "spike:snapshot" });

  assert.deepEqual(snapshot.windows, []);
  assert.equal(handleSpikeMessage(api, { type: "other" }), undefined);
});

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

test("moves only a loose, unpinned tab and verifies the result", async () => {
  const tabs = new Map([
    [10, { id: 10, windowId: 1, pinned: false, groupId: -1 }],
  ]);
  const api = {
    windows: {
      get: async () => ({ id: 2, type: "normal", incognito: false }),
    },
    tabs: {
      get: async (id) => tabs.get(id),
      move: async (id, { windowId }) => {
        tabs.set(id, { ...tabs.get(id), windowId });
      },
    },
  };

  assert.equal((await moveLooseTab(api, 10, 2)).windowId, 2);

  tabs.set(11, { id: 11, windowId: 1, pinned: true, groupId: -1 });
  await assert.rejects(() => moveLooseTab(api, 11, 2), /loose, unpinned/);
});

test("moves an existing group and verifies the result", async () => {
  const groups = new Map([[20, { id: 20, windowId: 1 }]]);
  const api = {
    windows: {
      get: async () => ({ id: 2, type: "normal", incognito: false }),
    },
    tabGroups: {
      get: async (id) => groups.get(id),
      move: async (id, { windowId }) => {
        groups.set(id, { ...groups.get(id), windowId });
      },
    },
  };

  assert.equal((await moveExistingGroup(api, 20, 2)).windowId, 2);
});
