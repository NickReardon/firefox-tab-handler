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
  const stored = await api.storage.local.get(RULES_KEY);
  return validateRules(stored[RULES_KEY] ?? []);
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

    ids.add(id);
    return { id, name, color: rule.color, match };
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
