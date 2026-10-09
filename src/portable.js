import { validateRules } from "./rules.js";

// Version 2 adds optional per-rule exclusions and version 3 adds optional
// possible-match rules (manualOnly). Older configs still import.
const CONFIG_VERSION = 3;
const SUPPORTED_CONFIG_VERSIONS = [1, 2, 3];
const INVENTORY_VERSION = 1;
const MATCHER_KEYS = ["hostnames", "urlIncludes", "titleIncludes"];

export function createRuleConfig(rules) {
  return { version: CONFIG_VERSION, rules: validateRules(rules) };
}

export function parseRuleConfig(text) {
  let config;

  try {
    config = JSON.parse(text);
  } catch {
    throw new Error("Rule config is not valid JSON.");
  }

  requireObject(config, "Rule config");
  requireKeys(config, ["version", "rules"], ["version", "rules"], "Rule config");
  if (!SUPPORTED_CONFIG_VERSIONS.includes(config.version)) {
    throw new Error(`Unsupported rule config version ${config.version}.`);
  }
  if (!Array.isArray(config.rules)) {
    throw new TypeError("Rule config rules must be an array.");
  }

  for (const [index, rule] of config.rules.entries()) {
    const label = `Rule ${index + 1}`;
    requireObject(rule, label);
    const required = ["id", "name", "color", "match"];
    const allowed = [
      ...required,
      ...(config.version >= 2 ? ["exclude"] : []),
      ...(config.version >= 3 ? ["manualOnly"] : []),
    ];
    requireKeys(rule, allowed, required, label);
    requireObject(rule.match, `${label} match`);
    requireKeys(rule.match, MATCHER_KEYS, [], `${label} match`);
    if (rule.exclude !== undefined) {
      requireObject(rule.exclude, `${label} exclude`);
      requireKeys(rule.exclude, MATCHER_KEYS, [], `${label} exclude`);
    }
  }

  return createRuleConfig(config.rules);
}

export function previewRuleReplacement(currentRules, replacementRules) {
  const current = validateRules(currentRules);
  const replacement = validateRules(replacementRules);
  const currentById = new Map(current.map((rule) => [rule.id, rule]));
  const replacementById = new Map(replacement.map((rule) => [rule.id, rule]));

  return {
    added: replacement.filter((rule) => !currentById.has(rule.id)),
    changed: replacement.filter((rule) => {
      const existing = currentById.get(rule.id);
      return existing && JSON.stringify(existing) !== JSON.stringify(rule);
    }),
    removed: current.filter((rule) => !replacementById.has(rule.id)),
  };
}

export function buildTabInventory(
  snapshot,
  { includeFullUrls = false, windowIds } = {},
) {
  if (typeof includeFullUrls !== "boolean") {
    throw new TypeError("includeFullUrls must be true or false.");
  }
  if (windowIds !== undefined && !Array.isArray(windowIds)) {
    throw new TypeError("windowIds must be an array.");
  }

  const selected = windowIds ? new Set(windowIds) : null;

  return {
    version: INVENTORY_VERSION,
    capturedAt: snapshot.capturedAt,
    windows: (snapshot.windows ?? [])
      .filter((window) => !selected || selected.has(window.id))
      .map((window) => {
        const groups = new Map(
          (window.groups ?? []).map((group) => [group.id, group.title]),
        );

        return {
          id: window.id,
          focused: Boolean(window.focused),
          tabs: (window.tabs ?? []).map((tab) => ({
            groupName: groups.get(tab.groupId) ?? null,
            title: tab.title ?? "",
            hostname: hostname(tab.url),
            url: sanitizeUrl(tab.url, includeFullUrls),
            pinned: Boolean(tab.pinned),
            cookieStoreId: tab.cookieStoreId ?? null,
          })),
        };
      }),
  };
}

export function downloadJson(filename, value) {
  const url = URL.createObjectURL(new Blob([
    `${JSON.stringify(value, null, 2)}\n`,
  ], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function sanitizeUrl(value, includeFullUrls) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    if (!includeFullUrls) {
      url.search = "";
      url.hash = "";
    }
    return url.href;
  } catch {
    return includeFullUrls ? (value ?? "") : (value ?? "").split(/[?#]/, 1)[0];
  }
}

function hostname(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}

function requireKeys(value, allowed, required, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  const missing = required.filter((key) => !(key in value));

  if (unknown.length) {
    throw new Error(`${label} has unknown field ${unknown[0]}.`);
  }
  if (missing.length) {
    throw new Error(`${label} is missing field ${missing[0]}.`);
  }
}
