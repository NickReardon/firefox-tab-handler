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
