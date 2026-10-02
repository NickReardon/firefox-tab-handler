import { matchesRule } from "./planner.js";
import { getRules } from "./rules.js";

export const CONTEXT_FULL_PREVIEW_MENU_ID = "preview-full-plan";
export const CONTEXT_AUTO_SORT_MENU_ID = "auto-sort-selected";
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

  const autoTabs = tabs.filter((tab) =>
    !tab.pinned && tab.groupId === -1 &&
    rules.some((rule) => matchesRule(rule, tab)),
  );
  const ruleMatches = rules
    .map((rule) => ({
      rule,
      tabs: tabs.filter((tab) =>
        !tab.pinned &&
        groupNames.get(tab.groupId) !== rule.name &&
        matchesRule(rule, tab),
      ),
    }))
    .filter(({ tabs: matchingTabs }) => matchingTabs.length);
  const single = tabs.length === 1;
  const firstMatch = single
    ? rules.find((rule) => matchesRule(rule, autoTabs[0] ?? {}))
    : undefined;

  await Promise.all([
    ...dynamicRuleMenuIds.map((id) => api.menus.remove(id).catch(() => {})),
    api.menus.update(FIRST_SEPARATOR_ID, { visible: autoTabs.length > 0 }),
    api.menus.update(CONTEXT_AUTO_SORT_MENU_ID, {
      title: single
        ? `Auto-sort into ${firstMatch?.name ?? "group"}`
        : "Auto-sort into groups",
      visible: autoTabs.length > 0,
    }),
    api.menus.update(CONTEXT_NO_MATCH_MENU_ID, {
      title: single
        ? (tabs[0].pinned
          ? "Pinned tabs are not sorted"
          : tabs[0].groupId === -1
            ? "No matching groups"
            : "No other matching groups")
        : "No matching groups for selected tabs",
      visible: ruleMatches.length === 0,
    }),
  ]);

  if (generation !== menuGeneration) {
    return;
  }

  dynamicRuleMenuIds = ruleMatches.map(({ rule, tabs: matchingTabs }) => {
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
  const tabIds = tabs
    .filter((tab) => !tab.pinned)
    .filter((tab) => rule
      ? groupNames.get(tab.groupId) !== rule.name && matchesRule(rule, tab)
      : tab.groupId === -1 && rules.some((candidate) => matchesRule(candidate, tab)))
    .map((tab) => tab.id);

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
