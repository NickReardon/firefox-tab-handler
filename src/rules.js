import { DEFAULT_RULES } from "./default-rules.js";

// A missing key means the user has no custom set and the defaults apply. An
// empty array is a custom set with no rules, so nothing is sorted.
const RULES_KEY = "rules";
const COLORS = new Set([
  "grey",
  "blue",
  "red",
  "yellow",
  "green",
  "pink",
  "purple",
  "cyan",
  "orange",
]);
const MATCHERS = ["hostnames", "urlIncludes", "titleIncludes"];

export async function getRules(api) {
  return (await getRuleState(api)).rules;
}

export async function getRuleState(api) {
  const { [RULES_KEY]: stored } = await api.storage.local.get(RULES_KEY);

  return stored === undefined
    ? { custom: false, rules: getDefaultRules() }
    : { custom: true, rules: validateRules(stored) };
}

export function getDefaultRules() {
  return validateRules(DEFAULT_RULES);
}

export async function clearCustomRules(api) {
  await api.storage.local.remove(RULES_KEY);
}

// Lists default groups in rule order. A group can span several rules, such as
// Development's topic and site rules.
export function defaultGroups(currentRules) {
  const currentIds = new Set(currentRules.map((rule) => rule.id));
  const groups = new Map();

  for (const rule of getDefaultRules()) {
    const group = groups.get(rule.name) ??
      { name: rule.name, color: rule.color, ruleCount: 0, copied: true };
    group.ruleCount += 1;
    group.copied &&= currentIds.has(rule.id);
    groups.set(rule.name, group);
  }

  return [...groups.values()];
}

// Appends every default rule in the group, skipping IDs the user already has.
export function copyDefaultGroup(currentRules, groupName) {
  const currentIds = new Set(currentRules.map((rule) => rule.id));
  const groupRules = getDefaultRules().filter((rule) => rule.name === groupName);

  if (!groupRules.length) {
    throw new Error(`Default group ${groupName} does not exist.`);
  }

  const added = groupRules.filter((rule) => !currentIds.has(rule.id));
  return {
    rules: [...currentRules, ...added],
    added: added.length,
    skipped: groupRules.length - added.length,
  };
}

export async function setRules(api, rules) {
  const validated = validateRules(rules);
  await api.storage.local.set({ [RULES_KEY]: validated });
  return validated;
}

export function validateRules(rules) {
  if (!Array.isArray(rules)) {
    throw new TypeError("Rules must be an array.");
  }

  const ids = new Set();

  return rules.map((rule, index) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      throw new TypeError(`Rule ${index + 1} must be an object.`);
    }

    const id = requiredString(rule.id, `Rule ${index + 1} ID`);
    const name = requiredString(rule.name, `Rule ${index + 1} name`);

    if (ids.has(id)) {
      throw new Error(`Rule ID ${id} is duplicated.`);
    }
    if (!COLORS.has(rule.color)) {
      throw new Error(`Rule ${name} has an unsupported color.`);
    }
    if (!rule.match || typeof rule.match !== "object" || Array.isArray(rule.match)) {
      throw new TypeError(`Rule ${name} must have match criteria.`);
    }

    const match = Object.fromEntries(
      MATCHERS.map((key) => [key, stringList(rule.match[key], `${name} ${key}`)]),
    );

    if (!MATCHERS.some((key) => match[key].length)) {
      throw new Error(`Rule ${name} must have at least one matcher.`);
    }
    if (
      rule.exclude !== undefined &&
      (!rule.exclude || typeof rule.exclude !== "object" || Array.isArray(rule.exclude))
    ) {
      throw new TypeError(`Rule ${name} exclusions must be an object.`);
    }

    const exclude = Object.fromEntries(
      MATCHERS.map((key) => [key, stringList(rule.exclude?.[key], `${name} exclude ${key}`)]),
    );

    if (rule.manualOnly !== undefined && typeof rule.manualOnly !== "boolean") {
      throw new TypeError(`Rule ${name} possible match setting must be true or false.`);
    }

    ids.add(id);
    return { id, name, color: rule.color, match, exclude, manualOnly: rule.manualOnly ?? false };
  });
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

function stringList(value, label) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array.`);
  }

  return value.map((item) => requiredString(item, label));
}
