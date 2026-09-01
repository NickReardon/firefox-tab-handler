import assert from "node:assert/strict";
import test from "node:test";

import { getRules, setRules, validateRules } from "../src/rules.js";

const rules = [{
  id: "epic",
  name: "Epic",
  color: "blue",
  match: {
    hostnames: ["dev.epicgames.com"],
    urlIncludes: [],
    titleIncludes: ["docs"],
  },
}];

test("validates and persists ordered rules", async () => {
  const stored = {};
  const api = {
    storage: {
      local: {
        get: async () => stored,
        set: async (values) => Object.assign(stored, values),
      },
    },
  };

  assert.deepEqual(await getRules(api), []);
  assert.deepEqual(await setRules(api, rules), rules);
  assert.deepEqual(await getRules(api), rules);
});

test("rejects duplicate IDs, unsupported colors, and empty matchers", () => {
  assert.throws(() => validateRules([...rules, rules[0]]), /duplicated/);
  assert.throws(() => validateRules([{ ...rules[0], color: "black" }]), /unsupported color/);
  assert.throws(
    () => validateRules([{ ...rules[0], match: {} }]),
    /at least one matcher/,
  );
});
