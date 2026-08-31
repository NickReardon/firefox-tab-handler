const NO_GROUP = -1;

export function handleSpikeMessage(api, message) {
  switch (message?.type) {
    case "spike:snapshot":
      return snapshotBrowser(api);
    case "spike:move-loose-tab":
      return moveLooseTab(api, message.tabId, message.destinationWindowId);
    case "spike:move-existing-group":
      return moveExistingGroup(api, message.groupId, message.destinationWindowId);
    default:
      return undefined;
  }
}

export async function snapshotBrowser(api) {
  const [windows, groups, lastFocusedWindow] = await Promise.all([
    api.windows.getAll({ populate: true, windowTypes: ["normal"] }),
    api.tabGroups.query({}),
    api.windows.getLastFocused(),
  ]);
  const eligibleWindows = windows.filter((window) => !window.incognito);
  const focusedWindow =
    eligibleWindows.find((window) => window.focused) ??
    eligibleWindows.find((window) => window.id === lastFocusedWindow.id);

  return {
    capturedAt: new Date().toISOString(),
    focusedWindowId: focusedWindow?.id ?? null,
    windows: eligibleWindows.map((window) => ({
      id: window.id,
      focused: window.focused,
      state: window.state,
      tabs: (window.tabs ?? []).map((tab) => ({
        id: tab.id,
        windowId: tab.windowId,
        index: tab.index,
        title: tab.title,
        url: tab.url,
        pinned: tab.pinned,
        active: tab.active,
        discarded: tab.discarded,
        cookieStoreId: tab.cookieStoreId,
        groupId: tab.groupId,
      })),
      groups: groups
        .filter((group) => group.windowId === window.id)
        .map((group) => ({
          id: group.id,
          title: group.title,
          color: group.color,
          collapsed: group.collapsed,
        })),
    })),
  };
}

async function requireDestinationWindow(api, windowId) {
  const window = await api.windows.get(windowId);

  if (window.type !== "normal" || window.incognito) {
    throw new Error("Destination must be a non-private normal window.");
  }
}

export async function moveLooseTab(api, tabId, destinationWindowId) {
  const tab = await api.tabs.get(tabId);

  if (tab.pinned || tab.groupId !== NO_GROUP) {
    throw new Error("Only loose, unpinned tabs can be moved by this spike.");
  }

  await requireDestinationWindow(api, destinationWindowId);
  await api.tabs.move(tabId, { windowId: destinationWindowId, index: -1 });
  const movedTab = await api.tabs.get(tabId);

  if (movedTab.windowId !== destinationWindowId || movedTab.groupId !== NO_GROUP) {
    throw new Error("Moved tab did not remain loose in the destination window.");
  }

  return movedTab;
}

export async function moveExistingGroup(api, groupId, destinationWindowId) {
  await api.tabGroups.get(groupId);
  await requireDestinationWindow(api, destinationWindowId);
  await api.tabGroups.move(groupId, {
    windowId: destinationWindowId,
    index: -1,
  });
  const movedGroup = await api.tabGroups.get(groupId);

  if (movedGroup.windowId !== destinationWindowId) {
    throw new Error("Moved group did not reach the destination window.");
  }

  return movedGroup;
}
