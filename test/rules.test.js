import assert from "node:assert/strict";
import test from "node:test";

import {
  clearCustomRules,
  copyDefaultGroup,
  defaultGroups,
  getDefaultRules,
  getRules,
  getRuleState,
  setRules,
  validateRules,
} from "../src/rules.js";

const rules = [{
  id: "epic",
  name: "Epic",
  color: "blue",
  match: {
    hostnames: ["dev.epicgames.com"],
    urlIncludes: [],
    titleIncludes: ["docs"],
  },
  exclude: { hostnames: [], urlIncludes: [], titleIncludes: [] },
}];

function storageApi() {
  const stored = {};
  return {
    stored,
    storage: {
      local: {
        get: async () => stored,
        set: async (values) => Object.assign(stored, values),
        remove: async (key) => { delete stored[key]; },
      },
    },
  };
}

test("validates and persists ordered rules", async () => {
  const api = storageApi();

  assert.deepEqual(await setRules(api, rules), rules);
  assert.deepEqual(await getRules(api), rules);
});

test("uses defaults only while no custom set exists", async () => {
  const api = storageApi();

  assert.deepEqual(await getRuleState(api), { custom: false, rules: getDefaultRules() });
  assert.ok(getDefaultRules().length > 0);

  await setRules(api, []);
  assert.deepEqual(await getRuleState(api), { custom: true, rules: [] });

  await setRules(api, rules);
  assert.deepEqual(await getRules(api), rules);

  await clearCustomRules(api);
  assert.equal("rules" in api.stored, false);
  assert.deepEqual(await getRules(api), getDefaultRules());
});

test("copies every rule in a default group and skips ones already present", () => {
  const development = getDefaultRules().filter((rule) => rule.name === "Development");
  assert.equal(development.length, 2);

  const first = copyDefaultGroup(rules, "Development");
  assert.deepEqual(first.rules, [...rules, ...development]);
  assert.equal(first.added, 2);
  assert.equal(first.skipped, 0);

  const second = copyDefaultGroup(first.rules, "Development");
  assert.deepEqual(second.rules, first.rules);
  assert.equal(second.added, 0);
  assert.equal(second.skipped, 2);

  assert.throws(() => copyDefaultGroup(rules, "Missing"), /does not exist/);
});

test("lists default groups once each and marks fully copied groups", () => {
  const groups = defaultGroups(copyDefaultGroup([], "Development").rules);
  const development = groups.find((group) => group.name === "Development");

  assert.equal(groups.filter((group) => group.name === "Development").length, 1);
  assert.deepEqual(development, {
    name: "Development",
    color: "green",
    ruleCount: 2,
    copied: true,
  });
  assert.equal(groups.find((group) => group.name === "Docs").copied, false);
});

test("normalizes optional exclusions and rejects malformed ones", () => {
  const [withExclude] = validateRules([{
    ...rules[0],
    exclude: { hostnames: [" mail.google.com "] },
  }]);
  assert.deepEqual(withExclude.exclude, {
    hostnames: ["mail.google.com"],
    urlIncludes: [],
    titleIncludes: [],
  });

  const { exclude, ...withoutExclude } = rules[0];
  assert.deepEqual(validateRules([withoutExclude])[0].exclude, exclude);
  assert.throws(
    () => validateRules([{ ...rules[0], exclude: ["mail.google.com"] }]),
    /exclusions must be an object/,
  );
});

test("rejects duplicate IDs, unsupported colors, and empty matchers", () => {
  assert.throws(() => validateRules([...rules, rules[0]]), /duplicated/);
  assert.throws(() => validateRules([{ ...rules[0], color: "black" }]), /unsupported color/);
  assert.throws(
    () => validateRules([{ ...rules[0], match: {} }]),
    /at least one matcher/,
  );
});
