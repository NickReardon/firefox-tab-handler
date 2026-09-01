import assert from "node:assert/strict";
import test from "node:test";

import {
  createDebugLogger,
  getDebugLogging,
  setDebugLogging,
} from "../src/logger.js";

test("persists and gates structured debug logging", async () => {
  const stored = {};
  const api = {
    storage: {
      local: {
        get: async () => stored,
        set: async (values) => Object.assign(stored, values),
      },
    },
  };
  const entries = [];

  assert.equal(await getDebugLogging(api), false);
  const disabledLog = await createDebugLogger(api, (...entry) => entries.push(entry));
  disabledLog("apply:start", { destinationWindowId: 1 });
  assert.deepEqual(entries, []);

  await setDebugLogging(api, true);
  const enabledLog = await createDebugLogger(api, (...entry) => entries.push(entry));
  enabledLog("apply:start", { destinationWindowId: 1 });
  assert.equal(entries.length, 1);
  assert.equal(entries[0][0], "[Firefox Tab Organizer] apply:start");
  assert.deepEqual(entries[0][1], { destinationWindowId: 1 });
});
