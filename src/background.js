import {
  applyOrganization,
  hasUndoSnapshot,
  undoLastOrganization,
} from "./executor.js";
import {
  createDebugLogger,
  getDebugLogging,
  setDebugLogging,
} from "./logger.js";
import { planOrganization } from "./planner.js";
import { snapshotBrowser } from "./spike.js";

export function handleBackgroundMessage(api, message) {
  switch (message?.type) {
    case "planner:preview":
      return snapshotBrowser(api).then((snapshot) => planOrganization(snapshot));
    case "planner:apply":
      return applyCurrentPlan(api, message.plan);
    case "planner:undo":
      return undoCurrentPlan(api);
    case "planner:undo-available":
      return hasUndoSnapshot(api);
    case "logging:get":
      return getDebugLogging(api);
    case "logging:set":
      return setDebugLogging(api, message.enabled);
    default:
      return undefined;
  }
}

async function applyCurrentPlan(api, approvedPlan) {
  const log = await createDebugLogger(api);

  try {
    const snapshot = await snapshotBrowser(api);
    const currentPlan = planOrganization(snapshot);

    if (JSON.stringify(currentPlan) !== JSON.stringify(approvedPlan)) {
      throw new Error("Browser state changed after preview. Review the refreshed plan.");
    }

    return await applyOrganization(api, snapshot, currentPlan);
  } catch (error) {
    log("apply:failed", { message: error.message });
    throw error;
  }
}

async function undoCurrentPlan(api) {
  const log = await createDebugLogger(api);

  try {
    return await undoLastOrganization(api);
  } catch (error) {
    log("undo:failed", { message: error.message });
    throw error;
  }
}

browser.runtime.onMessage.addListener((message) =>
  handleBackgroundMessage(browser, message),
);

console.info("Firefox Tab Organizer ready.");
