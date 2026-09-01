import { createDebugLogger } from "./logger.js";

const NO_GROUP = -1;
const UNDO_KEY = "undoSnapshot";
const UNDO_ANCHORS_KEY = "undoAnchorIds";

export async function applyOrganization(api, snapshot, plan) {
  const log = await createDebugLogger(api);
  log("apply:start", {
    destinationWindowId: plan.destinationWindowId,
    sourceWindowCount: movedSourceWindowIds(plan).length,
    preservedGroupCount: plan.preservedGroups.filter((group) => group.requiresMove).length,
    looseTabCount: orderedMoves(snapshot, plan).length,
    newGroupCount: plan.newGroups.length,
  });
  await validatePreApply(api, snapshot, plan.destinationWindowId);
  log("apply:preflight-complete");
  await api.storage.local.set({
    [UNDO_KEY]: snapshot,
    [UNDO_ANCHORS_KEY]: [],
  });
  log("apply:undo-snapshot-stored", { capturedAt: snapshot.capturedAt });

  const sourceWindowIds = movedSourceWindowIds(plan);
  const anchors = new Map();
  const anchorIds = [];

  for (const windowId of sourceWindowIds) {
    const anchor = await api.tabs.create({
      windowId,
      active: false,
      url: "about:blank",
    });
    anchors.set(windowId, anchor.id);
    anchorIds.push(anchor.id);
    await api.storage.local.set({ [UNDO_ANCHORS_KEY]: anchorIds });
    log("apply:anchor-created", { windowId, tabId: anchor.id });
  }

  for (const group of plan.preservedGroups.filter((item) => item.requiresMove)) {
    await api.tabGroups.move(group.id, {
      windowId: plan.destinationWindowId,
      index: -1,
    });
    log("apply:group-moved", {
      groupId: group.id,
      sourceWindowId: group.sourceWindowId,
      destinationWindowId: plan.destinationWindowId,
    });
  }

  const moves = orderedMoves(snapshot, plan);

  for (const move of moves.filter((item) => item.pinned)) {
    await api.tabs.move(move.tabId, {
      windowId: plan.destinationWindowId,
      index: move.destinationIndex,
    });
    log("apply:tab-moved", {
      tabId: move.tabId,
      sourceWindowId: move.sourceWindowId,
      destinationWindowId: plan.destinationWindowId,
      destinationIndex: move.destinationIndex,
      pinned: true,
    });
  }
  for (const move of moves.filter((item) => !item.pinned)) {
    await api.tabs.move(move.tabId, {
      windowId: plan.destinationWindowId,
      index: move.destinationIndex,
    });
    log("apply:tab-moved", {
      tabId: move.tabId,
      sourceWindowId: move.sourceWindowId,
      destinationWindowId: plan.destinationWindowId,
      destinationIndex: move.destinationIndex,
      pinned: false,
    });
  }

  const createdGroups = [];

  for (const group of plan.newGroups) {
    const groupId = await api.tabs.group({
      tabIds: group.tabMoves.map((move) => move.tabId),
      createProperties: { windowId: plan.destinationWindowId },
    });
    await api.tabGroups.update(groupId, {
      title: group.title,
      color: group.color,
    });
    createdGroups.push({ groupId, tabIds: group.tabMoves.map((move) => move.tabId) });
    log("apply:group-created", {
      groupId,
      ruleId: group.ruleId,
      tabIds: group.tabMoves.map((move) => move.tabId),
    });
  }

  if (plan.activeTabId !== null) {
    await api.tabs.update(plan.activeTabId, { active: true });
    log("apply:active-tab-restored", { tabId: plan.activeTabId });
  }
  await validateApplied(api, snapshot, plan, createdGroups, anchors);
  log("apply:validation-complete");

  for (const windowId of sourceWindowIds) {
    await api.windows.remove(windowId);
    log("apply:source-window-closed", { windowId });
  }

  const result = {
    movedGroups: plan.preservedGroups.filter((item) => item.requiresMove).length,
    movedTabs: moves.length,
    createdGroups: createdGroups.length,
    closedWindows: sourceWindowIds.length,
  };
  log("apply:complete", result);
  return result;
}

export async function undoLastOrganization(api) {
  const log = await createDebugLogger(api);
  const {
    [UNDO_KEY]: snapshot,
    [UNDO_ANCHORS_KEY]: applyAnchorIds = [],
  } = await api.storage.local.get([UNDO_KEY, UNDO_ANCHORS_KEY]);

  if (!snapshot) {
    log("undo:unavailable");
    return {
      restoredTabs: 0,
      restoredGroups: 0,
      unchangedTabs: 0,
      unchangedGroups: 0,
      warnings: ["No undo is available."],
    };
  }

  log("undo:start", {
    originalWindowCount: snapshot.windows.length,
    originalTabCount: snapshot.windows.flatMap((window) => window.tabs).length,
  });

  const warnings = [];
  const windowIds = new Map();
  const anchors = new Map();

  async function removeAnchor(windowId) {
    const anchorId = anchors.get(windowId);

    if (anchorId !== undefined) {
      await api.tabs.remove(anchorId);
      anchors.delete(windowId);
    }
  }

  for (const original of snapshot.windows) {
    try {
      await api.windows.get(original.id);
      windowIds.set(original.id, original.id);
      log("undo:window-reused", { originalWindowId: original.id });
    } catch {
      const created = await api.windows.create({
        focused: false,
        ...(original.state ? { state: original.state } : {}),
      });
      windowIds.set(original.id, created.id);
      anchors.set(created.id, created.tabs[0].id);
      log("undo:window-created", {
        originalWindowId: original.id,
        restoredWindowId: created.id,
        anchorTabId: created.tabs[0].id,
      });
    }
  }

  const liveGroups = new Map(
    (await api.tabGroups.query({})).map((group) => [group.id, group]),
  );
  const restoreWindows = [
    ...snapshot.windows.filter((window) => window.id !== snapshot.focusedWindowId),
    ...snapshot.windows.filter((window) => window.id === snapshot.focusedWindowId),
  ];
  let restoredGroups = 0;
  let unchangedGroups = 0;

  for (const original of restoreWindows) {
    const targetWindowId = windowIds.get(original.id);
    const groups = new Map(original.groups.map((group) => [group.id, group]));
    const groupIds = original.tabs
      .filter((tab) => tab.groupId !== NO_GROUP)
      .map((tab) => tab.groupId)
      .filter((groupId, index, ids) => ids.indexOf(groupId) === index);

    for (const groupId of groupIds) {
      const group = groups.get(groupId);
      const live = liveGroups.get(groupId);

      if (!live) {
        warnings.push(`Group ${groupId} disappeared and could not be restored.`);
        continue;
      }

      const needsMove = live.windowId !== targetWindowId;
      const needsMetadata = group && (
        live.title !== group.title ||
        live.color !== group.color ||
        live.collapsed !== group.collapsed
      );

      if (!group) {
        warnings.push(`Group ${groupId} metadata was unavailable during undo.`);
      }
      if (!needsMove && !needsMetadata) {
        unchangedGroups += 1;
        continue;
      }

      try {
        if (needsMove) {
          await api.tabGroups.move(groupId, { windowId: targetWindowId, index: -1 });
        }
        if (needsMetadata) {
          await api.tabGroups.update(groupId, {
            title: group.title,
            color: group.color,
            collapsed: group.collapsed,
          });
        }
        if (needsMove) {
          await removeAnchor(targetWindowId);
        }
        restoredGroups += 1;
        log("undo:group-restored", {
          groupId,
          originalWindowId: original.id,
          restoredWindowId: targetWindowId,
          moved: needsMove,
          metadataUpdated: Boolean(needsMetadata),
        });
      } catch (error) {
        warnings.push(`Group ${groupId} could not be restored: ${error.message}`);
      }
    }
  }

  let restoredTabs = 0;
  let unchangedTabs = 0;

  for (const original of restoreWindows) {
    const targetWindowId = windowIds.get(original.id);
    const desiredTabs = [
      ...original.tabs.filter((tab) => tab.pinned),
      ...original.tabs.filter((tab) => !tab.pinned),
    ];
    const desiredIndexes = new Map(desiredTabs.map((tab, index) => [tab.id, index]));
    const looseTabs = desiredTabs.filter((tab) => tab.groupId === NO_GROUP);

    for (const expected of looseTabs) {
      let live;

      try {
        live = await api.tabs.get(expected.id);
      } catch {
        warnings.push(`Tab ${expected.id} disappeared and could not be restored.`);
        continue;
      }

      try {
        const desiredIndex = desiredIndexes.get(expected.id);

        if (
          live.windowId === targetWindowId &&
          live.groupId === NO_GROUP &&
          live.pinned === expected.pinned &&
          live.index === desiredIndex
        ) {
          unchangedTabs += 1;
          continue;
        }

        if (live.groupId !== NO_GROUP) {
          await api.tabs.ungroup(expected.id);
        }
        if (live.pinned !== expected.pinned) {
          await api.tabs.update(expected.id, { pinned: expected.pinned });
        }

        const targetTabs = await api.tabs.query({ windowId: targetWindowId });
        const index = Math.min(desiredIndex, targetTabs.length);
        await api.tabs.move(expected.id, { windowId: targetWindowId, index });
        await removeAnchor(targetWindowId);
        restoredTabs += 1;
        log("undo:tab-restored", {
          tabId: expected.id,
          originalWindowId: original.id,
          restoredWindowId: targetWindowId,
          destinationIndex: index,
          pinned: expected.pinned,
        });
      } catch (error) {
        warnings.push(`Tab ${expected.id} could not be restored: ${error.message}`);
      }
    }

    const activeTab = original.tabs.find((tab) => tab.active);

    if (activeTab) {
      try {
        await api.tabs.update(activeTab.id, { active: true });
      } catch {
        warnings.push(`Active tab ${activeTab.id} could not be restored.`);
      }
    }
  }

  for (const [windowId, anchorId] of anchors) {
    const tabs = await api.tabs.query({ windowId });

    if (tabs.length > 1) {
      await api.tabs.remove(anchorId);
    } else {
      warnings.push(`Window ${windowId} was left open because none of its tabs survived.`);
    }
  }

  for (const anchorId of applyAnchorIds) {
    try {
      const anchor = await api.tabs.get(anchorId);
      const tabs = await api.tabs.query({ windowId: anchor.windowId });

      if (tabs.length > 1) {
        await api.tabs.remove(anchorId);
      } else {
        warnings.push(`Temporary anchor tab ${anchorId} was left open for safety.`);
      }
    } catch {
      // Successful apply closes source windows and their temporary anchors.
    }
  }

  const focusedWindowId = windowIds.get(snapshot.focusedWindowId);

  if (focusedWindowId !== undefined) {
    await api.windows.update(focusedWindowId, { focused: true });
    log("undo:focused-window-restored", { windowId: focusedWindowId });
  }

  await api.storage.local.remove([UNDO_KEY, UNDO_ANCHORS_KEY]);

  const result = {
    restoredTabs,
    restoredGroups,
    unchangedTabs,
    unchangedGroups,
    warnings,
  };
  log("undo:complete", result);
  return result;
}

export async function hasUndoSnapshot(api) {
  const { [UNDO_KEY]: snapshot } = await api.storage.local.get(UNDO_KEY);
  return Boolean(snapshot);
}

function movedSourceWindowIds(plan) {
  return [
    ...plan.preservedGroups,
    ...plan.looseTabMoves,
    ...plan.newGroups.flatMap((group) => group.tabMoves),
  ]
    .filter((item) => item.requiresMove)
    .map((item) => item.sourceWindowId)
    .filter((windowId, index, windowIds) => windowIds.indexOf(windowId) === index);
}

function orderedMoves(snapshot, plan) {
  const moves = new Map(
    [...plan.looseTabMoves, ...plan.newGroups.flatMap((group) => group.tabMoves)]
      .filter((move) => move.requiresMove)
      .map((move) => [move.tabId, move]),
  );

  const destination = snapshot.windows.find(
    (window) => window.id === plan.destinationWindowId,
  );
  const sources = snapshot.windows.filter(
    (window) => window.id !== plan.destinationWindowId,
  );
  const desiredTabs = [
    ...destination.tabs.filter((tab) => tab.pinned),
    ...sources.flatMap((window) => window.tabs.filter((tab) => tab.pinned)),
    ...destination.tabs.filter((tab) => !tab.pinned),
    ...sources.flatMap((window) => window.tabs.filter((tab) => !tab.pinned)),
  ];

  return desiredTabs
    .map((tab) => moves.get(tab.id))
    .map((move, destinationIndex) =>
      move ? { ...move, destinationIndex } : undefined,
    )
    .filter(Boolean);
}

async function validatePreApply(api, snapshot, destinationWindowId) {
  const destination = await api.windows.get(destinationWindowId);

  if (destination.type !== "normal" || destination.incognito) {
    throw new Error("Destination is no longer an eligible normal window.");
  }

  const liveTabs = new Map((await api.tabs.query({})).map((tab) => [tab.id, tab]));

  for (const expected of snapshot.windows.flatMap((window) => window.tabs)) {
    const live = liveTabs.get(expected.id);

    if (
      !live ||
      live.windowId !== expected.windowId ||
      live.groupId !== expected.groupId
    ) {
      throw new Error(`Tab ${expected.id} changed after preview. Refresh the plan.`);
    }
  }
}

async function validateApplied(api, snapshot, plan, createdGroups, anchors) {
  const destinationTabs = new Map(
    (await api.tabs.query({ windowId: plan.destinationWindowId })).map((tab) => [
      tab.id,
      tab,
    ]),
  );

  for (const expected of snapshot.windows.flatMap((window) => window.tabs)) {
    const live = destinationTabs.get(expected.id);

    if (!live) {
      throw new Error(`Tab ${expected.id} did not reach the destination window.`);
    }
    if (expected.pinned && live.groupId !== NO_GROUP) {
      throw new Error(`Pinned tab ${expected.id} was grouped.`);
    }
  }

  if (
    plan.activeTabId !== null &&
    !destinationTabs.get(plan.activeTabId)?.active
  ) {
    throw new Error(`Active tab ${plan.activeTabId} was not restored.`);
  }

  for (const group of plan.preservedGroups) {
    const live = await api.tabGroups.get(group.id);

    if (
      live.windowId !== plan.destinationWindowId ||
      live.title !== group.title ||
      live.color !== group.color ||
      live.collapsed !== group.collapsed
    ) {
      throw new Error(`Preserved group ${group.id} failed validation.`);
    }
  }

  for (const group of createdGroups) {
    for (const tabId of group.tabIds) {
      if (destinationTabs.get(tabId)?.groupId !== group.groupId) {
        throw new Error(`New group ${group.groupId} failed validation.`);
      }
    }
  }

  for (const [windowId, anchorId] of anchors) {
    const tabs = await api.tabs.query({ windowId });

    if (tabs.length !== 1 || tabs[0].id !== anchorId) {
      throw new Error(`Source window ${windowId} is not safe to close.`);
    }
  }
}
