import { matchesGroup, matchesRule, primaryRule } from "./planner.js";
import { getRules } from "./rules.js";

export const CONTEXT_FULL_PREVIEW_MENU_ID = "preview-full-plan";
export const CONTEXT_AUTO_SORT_MENU_ID = "auto-sort-selected";
export const CONTEXT_OTHER_GROUPS_MENU_ID = "other-possible-groups";
export const CONTEXT_NO_MATCH_MENU_ID = "no-matching-rule";
const FIRST_SEPARATOR_ID = "tab-organizer-separator-1";
const SECOND_SEPARATOR_ID = "tab-organizer-separator-2";
const RULE_MENU_PREFIX = "sort-matching-rule:";

let dynamicRuleMenuIds = [];
let menuGeneration = 0;

export async function registerContextMenu(api) {
  await api.menus.removeAll();

  dynamicRuleMenuIds = [];
  for (const item of [
    {
      id: CONTEXT_FULL_PREVIEW_MENU_ID,
      title: "Preview full plan",
      contexts: ["tab"],
    },
    {
      id: FIRST_SEPARATOR_ID,
      type: "separator",
      contexts: ["tab"],
    },
    {
      id: CONTEXT_AUTO_SORT_MENU_ID,
      title: "Auto-sort into groups",
      contexts: ["tab"],
      visible: false,
    },
    {
      id: SECOND_SEPARATOR_ID,
      type: "separator",
      contexts: ["tab"],
    },
    {
      id: CONTEXT_OTHER_GROUPS_MENU_ID,
      title: "Other possible groups",
      contexts: ["tab"],
      enabled: false,
      visible: false,
    },
    {
      id: CONTEXT_NO_MATCH_MENU_ID,
      title: "No matching groups",
      contexts: ["tab"],
      enabled: false,
    },
  ]) {
    api.menus.create(item);
  }
}

export async function refreshContextMenu(api, clickedTab) {
  if (!clickedTab) {
    return;
  }

  const generation = ++menuGeneration;
  const { tabs, rules, groupNames } = await getMenuContext(api, clickedTab);

  if (generation !== menuGeneration) {
    return;
  }

  const autoTargets = autoSortTargets(tabs, rules);
  const groupMatches = otherGroupMatches(tabs, rules, groupNames, autoTargets);
  const autoNames = [...new Set(autoTargets.values())];
  const single = tabs.length === 1;
  const showAuto = autoTargets.size > 0;
  const showOthers = groupMatches.length > 0;

  await Promise.all([
    ...dynamicRuleMenuIds.map((id) => api.menus.remove(id).catch(() => {})),
    api.menus.update(FIRST_SEPARATOR_ID, { visible: showAuto }),
    api.menus.update(CONTEXT_AUTO_SORT_MENU_ID, {
      title: autoSortTitle(single, autoTargets.size, autoNames),
      visible: showAuto,
    }),
    api.menus.update(SECOND_SEPARATOR_ID, { visible: !showAuto || showOthers }),
    api.menus.update(CONTEXT_OTHER_GROUPS_MENU_ID, { visible: showOthers }),
    api.menus.update(CONTEXT_NO_MATCH_MENU_ID, {
      title: single
        ? (tabs[0].pinned
          ? "Pinned tabs are not sorted"
          : tabs[0].groupId === -1
            ? "No matching groups"
            : "No other matching groups")
        : "No matching groups for selected tabs",
      visible: !showAuto && !showOthers,
    }),
  ]);

  if (generation !== menuGeneration) {
    return;
  }

  dynamicRuleMenuIds = groupMatches.map(({ rule, tabs: matchingTabs }) => {
    const id = `${RULE_MENU_PREFIX}${rule.id}`;
    api.menus.create({
      id,
      title: single
        ? `Move tab into ${rule.name}`
        : `Move ${matchingTabs.length} matching tab${matchingTabs.length === 1 ? "" : "s"} into ${rule.name}`,
      contexts: ["tab"],
      icons: { 16: `icons/groups/${rule.color}.svg` },
    });
    return id;
  });
  await api.menus.refresh();
}

// Maps each loose, unpinned tab to the group name its primary rule sorts it
// into. Grouped tabs stay where they are.
function autoSortTargets(tabs, rules) {
  const targets = new Map();
  for (const tab of tabs) {
    const rule = !tab.pinned && tab.groupId === -1 ? primaryRule(rules, tab) : undefined;
    if (rule) {
      targets.set(tab.id, rule.name);
    }
  }
  return targets;
}

const AUTO_SORT_NAME_LIMIT = 2;

function autoSortTitle(single, tabCount, names) {
  if (single) {
    return `Auto-sort into ${names[0] ?? "group"}`;
  }

  const shown = names.slice(0, AUTO_SORT_NAME_LIMIT).join(", ");
  const hidden = names.length - AUTO_SORT_NAME_LIMIT;
  return `Auto-sort ${tabCount} tab${tabCount === 1 ? "" : "s"} into ${shown}` +
    (hidden > 0 ? ` +${hidden}` : "");
}

// Lists one entry per group name: normal rule matches in rule order, then
// possible-match rules. A group is skipped when auto-sort already moves
// exactly those tabs into it, and for tabs already in that group.
function otherGroupMatches(tabs, rules, groupNames, autoTargets) {
  const ordered = [
    ...rules.filter((rule) => !rule.manualOnly),
    ...rules.filter((rule) => rule.manualOnly),
  ];
  const seen = new Set();
  const matches = [];

  for (const rule of ordered) {
    if (seen.has(rule.name)) {
      continue;
    }

    const movable = (tab) => !tab.pinned && groupNames.get(tab.groupId) !== rule.name;
    if (!tabs.some((tab) => movable(tab) && matchesRule(rule, tab))) {
      continue;
    }

    seen.add(rule.name);
    const matchingTabs = tabs.filter((tab) =>
      movable(tab) && matchesGroup(rules, rule.name, tab));
    if (matchingTabs.every((tab) => autoTargets.get(tab.id) === rule.name)) {
      continue;
    }
    matches.push({ rule, tabs: matchingTabs });
  }

  return matches;
}

export function hideContextMenu() {
  menuGeneration += 1;
}

export async function handleContextMenuClick(api, info, clickedTab, applyScope) {
  if (info.menuItemId === CONTEXT_FULL_PREVIEW_MENU_ID) {
    await api.action.openPopup();
    return undefined;
  }
  if (
    info.menuItemId !== CONTEXT_AUTO_SORT_MENU_ID &&
    !String(info.menuItemId).startsWith(RULE_MENU_PREFIX)
  ) {
    return undefined;
  }

  const { tabs, rules, groupNames } = await getMenuContext(api, clickedTab);
  const ruleId = String(info.menuItemId).startsWith(RULE_MENU_PREFIX)
    ? String(info.menuItemId).slice(RULE_MENU_PREFIX.length)
    : undefined;
  const rule = ruleId === undefined
    ? undefined
    : rules.find((candidate) => candidate.id === ruleId);
  const tabIds = rule
    ? tabs
      .filter((tab) => !tab.pinned && groupNames.get(tab.groupId) !== rule.name)
      .filter((tab) => matchesGroup(rules, rule.name, tab))
      .map((tab) => tab.id)
    : [...autoSortTargets(tabs, rules).keys()];

  if (!tabIds.length) {
    return undefined;
  }

  const scope = {
    windowId: clickedTab.windowId,
    tabIds,
    ...(ruleId === undefined ? {} : { ruleId }),
  };

  return applyScope(scope);
}

async function getMenuContext(api, clickedTab) {
  const [tabs, rules, groups] = await Promise.all([
    getContextTabs(api, clickedTab),
    getRules(api),
    api.tabGroups.query({ windowId: clickedTab.windowId }),
  ]);
  return {
    tabs,
    rules,
    groupNames: new Map(groups.map((group) => [group.id, group.title])),
  };
}

async function getContextTabs(api, clickedTab) {
  if (!clickedTab.highlighted) {
    return [clickedTab];
  }

  const highlightedTabs = await api.tabs.query({
    windowId: clickedTab.windowId,
    highlighted: true,
  });
  return highlightedTabs.length > 1 &&
      highlightedTabs.some((tab) => tab.id === clickedTab.id)
    ? highlightedTabs
    : [clickedTab];
}
