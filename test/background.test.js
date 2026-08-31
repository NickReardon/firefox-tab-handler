import assert from "node:assert/strict";
import test from "node:test";

globalThis.browser = { runtime: { onMessage: { addListener() {} } } };

const { handleBackgroundMessage } = await import("../src/background.js");

test("builds a preview without exposing mutation messages", async () => {
  const api = {
    windows: {
      getAll: async () => [
        {
          id: 1,
          focused: true,
          incognito: false,
          tabs: [{ id: 10, windowId: 1, index: 0, active: true, groupId: -1 }],
        },
      ],
      getLastFocused: async () => ({ id: 1 }),
    },
    tabs: {
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
  assert.equal(
    handleBackgroundMessage(api, { type: "spike:move-loose-tab" }),
    undefined,
  );
  assert.equal(handleBackgroundMessage(api, { type: "unknown" }), undefined);
});
