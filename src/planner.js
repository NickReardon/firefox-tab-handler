const NO_GROUP = -1;

export function planOrganization(snapshot, rules = [], { tabIds, ruleId } = {}) {
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
  const includedTabIds = tabIds ? new Set(tabIds) : undefined;
  const selectedRule = ruleId === undefined
    ? undefined
    : rules.find((rule) => rule.id === ruleId);

  if (ruleId !== undefined && !selectedRule) {
    throw new Error(`Rule ${ruleId} is no longer available.`);
  }

  for (const window of windows) {
    const groups = new Map((window.groups ?? []).map((group) => [group.id, group]));

    for (const tab of window.tabs ?? []) {
      if (includedTabIds && !includedTabIds.has(tab.id)) {
        continue;
      }

      const selectedRuleMatch = selectedRule && !tab.pinned &&
        matchesRule(selectedRule, tab);

      if (selectedRule && !selectedRuleMatch) {
        throw new Error(`Tab ${tab.id} no longer matches rule ${selectedRule.name}.`);
      }

      if (
        tab.groupId !== undefined &&
        tab.groupId !== null &&
        tab.groupId !== NO_GROUP &&
        !selectedRuleMatch
      ) {
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
      const rule = !tab.pinned && (selectedRule
        ? (matchesRule(selectedRule, tab) ? selectedRule : undefined)
        : rules.find((candidate) => matchesRule(candidate, tab)));

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

    if (includedTabIds) {
      if (group) {
        const target = matchingGroups[0] ?? (destination.groups ?? []).find(
          (candidate) => candidate.title === rule.name,
        );

        if (target) {
          group.targetGroupId = target.id;
        }
      }

      continue;
    }

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

// A rule matches when any include matcher hits and no exclude matcher does. An
// excluded tab falls through to the next rule.
export function matchesRule(rule, tab) {
  const url = (tab.url ?? "").toLowerCase();
  const title = (tab.title ?? "").toLowerCase();
  let hostname = "";

  try {
    hostname = new URL(tab.url).hostname.toLowerCase();
  } catch {
    // Non-URL browser pages can still match URL or title text.
  }

  const hits = (matchers = {}) =>
    (matchers.hostnames ?? []).some((value) => value.toLowerCase() === hostname) ||
    (matchers.urlIncludes ?? []).some((value) => url.includes(value.toLowerCase())) ||
    (matchers.titleIncludes ?? []).some((value) => title.includes(value.toLowerCase()));

  return hits(rule.match) && !hits(rule.exclude);
}
