const NO_GROUP = -1;

export function planOrganization(snapshot, rules = []) {
  const windows = (snapshot.windows ?? []).filter(
    (window) => !window.incognito && (!window.type || window.type === "normal"),
  );
  const destination = windows.find(
    (window) => window.id === snapshot.focusedWindowId,
  );

  if (!destination) {
    throw new Error("No eligible focused destination window.");
  }

  const plan = {
    destinationWindowId: destination.id,
    preservedGroups: [],
    looseTabMoves: [],
    newGroups: [],
    warnings: [],
    activeTabId: destination.tabs?.find((tab) => tab.active)?.id ?? null,
  };
  const plannedGroups = new Map();
  const ruleGroups = new Map();

  for (const window of windows) {
    const groups = new Map((window.groups ?? []).map((group) => [group.id, group]));

    for (const tab of window.tabs ?? []) {
      if (tab.groupId !== undefined && tab.groupId !== null && tab.groupId !== NO_GROUP) {
        let group = plannedGroups.get(tab.groupId);

        if (!group) {
          const metadata = groups.get(tab.groupId);
          group = {
            id: tab.groupId,
            title: metadata?.title ?? "",
            color: metadata?.color ?? "grey",
            collapsed: metadata?.collapsed ?? false,
            sourceWindowId: window.id,
            destinationWindowId: destination.id,
            sourceIndex: tab.index,
            requiresMove: window.id !== destination.id,
            tabIds: [],
          };
          plannedGroups.set(tab.groupId, group);
          plan.preservedGroups.push(group);

          if (!metadata) {
            plan.warnings.push(`Missing metadata for group ${tab.groupId}.`);
          }
        }

        group.tabIds.push(tab.id);
        continue;
      }

      const move = {
        tabId: tab.id,
        title: tab.title ?? "Untitled tab",
        sourceWindowId: window.id,
        destinationWindowId: destination.id,
        sourceIndex: tab.index,
        requiresMove: window.id !== destination.id,
        pinned: Boolean(tab.pinned),
      };
      const rule = !tab.pinned && rules.find((candidate) => matches(candidate, tab));

      if (!rule) {
        plan.looseTabMoves.push(move);
        continue;
      }

      let group = ruleGroups.get(rule.name);

      if (!group) {
        group = {
          ruleId: rule.id,
          title: rule.name,
          color: rule.color,
          tabMoves: [],
        };
        ruleGroups.set(rule.name, group);
        plan.newGroups.push(group);
      }

      group.tabMoves.push(move);
    }
  }

  for (const rule of rules) {
    const matchingGroups = plan.preservedGroups.filter(
      (group) => group.title === rule.name,
    );
    let group = ruleGroups.get(rule.name);

    if (!group && matchingGroups.length < 2) {
      continue;
    }
    if (!group) {
      group = {
        ruleId: rule.id,
        title: rule.name,
        color: rule.color,
        tabMoves: [],
      };
      ruleGroups.set(rule.name, group);
      plan.newGroups.push(group);
    }
    if (matchingGroups.length) {
      const target = matchingGroups.find(
        (candidate) => candidate.sourceWindowId === destination.id,
      ) ?? matchingGroups[0];
      const mergeGroupIds = matchingGroups
        .filter((candidate) => candidate.id !== target.id)
        .map((candidate) => candidate.id);

      group.targetGroupId = target.id;
      if (mergeGroupIds.length) {
        group.mergeGroupIds = mergeGroupIds;
        group.mergeTabCount = matchingGroups
          .filter((candidate) => candidate.id !== target.id)
          .reduce((count, candidate) => count + candidate.tabIds.length, 0);
      }
    }
  }

  if (plan.activeTabId === null) {
    plan.warnings.push("The destination window has no active tab to restore.");
  }

  return plan;
}

function matches(rule, tab) {
  const match = rule.match ?? {};
  const url = (tab.url ?? "").toLowerCase();
  const title = (tab.title ?? "").toLowerCase();
  let hostname = "";

  try {
    hostname = new URL(tab.url).hostname.toLowerCase();
  } catch {
    // Non-URL browser pages can still match URL or title text.
  }

  return (
    (match.hostnames ?? []).some((value) => value.toLowerCase() === hostname) ||
    (match.urlIncludes ?? []).some((value) => url.includes(value.toLowerCase())) ||
    (match.titleIncludes ?? []).some((value) => title.includes(value.toLowerCase()))
  );
}
