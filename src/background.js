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
import {
  handleContextMenuClick,
  hideContextMenu,
  refreshContextMenu,
  registerContextMenu,
} from "./context-menu.js";
import { planOrganization } from "./planner.js";
import { buildTabInventory } from "./portable.js";
import { getRules } from "./rules.js";
import { snapshotBrowser } from "./snapshot.js";

export function handleBackgroundMessage(api, message) {
  switch (message?.type) {
    case "planner:preview":
      return previewCurrentPlan(api);
    case "planner:apply":
      return applyCurrentPlan(api, message.plan);
    case "planner:undo":
      return undoCurrentPlan(api, message.confirmed === true);
    case "planner:undo-available":
      return hasUndoSnapshot(api);
    case "logging:get":
      return getDebugLogging(api);
    case "logging:set":
      return setDebugLogging(api, message.enabled);
    case "inventory:get":
      return snapshotBrowser(api).then((snapshot) =>
        buildTabInventory(snapshot, {
          includeFullUrls: message.includeFullUrls,
          windowIds: message.windowIds,
        }),
      );
    default:
      return undefined;
  }
}

async function previewCurrentPlan(api) {
  const [snapshot, rules] = await Promise.all([
    snapshotBrowser(api),
    getRules(api),
  ]);

  return planOrganization(snapshot, rules);
}

function buildCurrentPlan(snapshot, rules, scope) {
  if (!scope) {
    return { snapshot, plan: planOrganization(snapshot, rules) };
  }

  if (
    !Number.isInteger(scope.windowId) ||
    !Array.isArray(scope.tabIds) ||
    scope.tabIds.length === 0 ||
    scope.tabIds.some((tabId) => !Number.isInteger(tabId)) ||
    new Set(scope.tabIds).size !== scope.tabIds.length ||
    (scope.ruleId !== undefined &&
      (typeof scope.ruleId !== "string" || !scope.ruleId.trim()))
  ) {
    throw new Error("The selected-tab preview scope is invalid.");
  }

  const window = snapshot.windows.find((candidate) => candidate.id === scope.windowId);
  const liveTabIds = new Set((window?.tabs ?? []).map((tab) => tab.id));

  if (!window || scope.tabIds.some((tabId) => !liveTabIds.has(tabId))) {
    throw new Error("A selected tab disappeared before preview.");
  }

  const scopedSnapshot = {
    ...snapshot,
    focusedWindowId: window.id,
    windows: [window],
  };
  const plan = planOrganization(scopedSnapshot, rules, {
    tabIds: scope.tabIds,
    ruleId: scope.ruleId,
  });

  return { snapshot: scopedSnapshot, plan: { ...plan, scope } };
}

async function applyCurrentPlan(api, approvedPlan) {
  const log = await createDebugLogger(api);

  try {
    const [snapshot, rules] = await Promise.all([
      snapshotBrowser(api),
      getRules(api),
    ]);
    const { snapshot: applySnapshot, plan: currentPlan } = buildCurrentPlan(
      snapshot,
      rules,
      approvedPlan?.scope,
    );

    if (JSON.stringify(currentPlan) !== JSON.stringify(approvedPlan)) {
      throw new Error("Browser state changed after preview. Review the refreshed plan.");
    }

    return await applyOrganization(api, applySnapshot, currentPlan);
  } catch (error) {
    log("apply:failed", { message: error.message });
    throw error;
  }
}

// Context actions apply without a preview because they touch only the selected
// tabs in one window. The full sort always goes through the popup preview.
async function applyContextScope(api, scope) {
  const log = await createDebugLogger(api);

  try {
    const [snapshot, rules] = await Promise.all([
      snapshotBrowser(api),
      getRules(api),
    ]);
    const { snapshot: applySnapshot, plan } = buildCurrentPlan(
      snapshot,
      rules,
      scope,
    );
    return await applyOrganization(api, applySnapshot, plan);
  } catch (error) {
    log("apply:failed", { message: error.message, scoped: true });
    throw error;
  }
}

async function undoCurrentPlan(api, confirmed) {
  const log = await createDebugLogger(api);

  try {
    return await undoLastOrganization(api, { confirmed });
  } catch (error) {
    log("undo:failed", { message: error.message });
    throw error;
  }
}

browser.runtime.onMessage.addListener((message) =>
  handleBackgroundMessage(browser, message),
);

if (browser.menus) {
  registerContextMenu(browser).catch((error) =>
    console.error("Could not register tab context menu.", error),
  );
  browser.menus.onClicked.addListener((info, tab) => {
    handleContextMenuClick(
      browser,
      info,
      tab,
      (scope) => applyContextScope(browser, scope),
    ).catch((error) => console.error("Could not run tab context action.", error));
  });
  browser.menus.onShown.addListener((_info, tab) => {
    refreshContextMenu(browser, tab).catch((error) =>
      console.error("Could not refresh tab context menu.", error),
    );
  });
  browser.menus.onHidden.addListener(hideContextMenu);
}

console.info("Firefox Tab Organizer ready.");
