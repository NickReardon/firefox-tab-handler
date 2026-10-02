import assert from "node:assert/strict";
import test from "node:test";

import { rulesChanged, setRuleCollapsed, summarizeRule } from "../src/options-ui.js";

test("detects rule data that differs from the saved snapshot", () => {
  const saved = [{ id: "one", name: "One" }];
  const savedJson = JSON.stringify(saved);

  assert.equal(rulesChanged(savedJson, saved), false);
  assert.equal(rulesChanged(savedJson, [{ id: "one", name: "Changed" }]), true);
});

test("collapses rule fields without hiding its controls", () => {
  const toggle = {
    textContent: "",
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  const fields = { hidden: false };
  const condensed = { hidden: true };
  const row = {
    querySelector(selector) {
      if (selector === ".toggle-rule") {
        return toggle;
      }
      return selector === ".rule-fields" ? fields : condensed;
    },
  };

  setRuleCollapsed(row, true);
  assert.equal(fields.hidden, true);
  assert.equal(condensed.hidden, false);
  assert.equal(toggle["aria-expanded"], "false");
  assert.equal(toggle.textContent, "Expand");

  setRuleCollapsed(row, false);
  assert.equal(fields.hidden, false);
  assert.equal(condensed.hidden, true);
  assert.equal(toggle["aria-expanded"], "true");
  assert.equal(toggle.textContent, "Collapse");
});

test("summarizes populated rule fields on one line", () => {
  assert.equal(summarizeRule({
    color: "blue",
    match: {
      hostnames: ["example.com"],
      urlIncludes: [],
      titleIncludes: ["Docs"],
    },
  }), "Hosts: example.com · Titles: Docs");
  assert.equal(summarizeRule({
    match: { hostnames: [], urlIncludes: [], titleIncludes: ["unreal engine"] },
    exclude: { hostnames: ["mail.google.com"], urlIncludes: [], titleIncludes: ["newsletter"] },
  }), "Titles: unreal engine · Not: mail.google.com, newsletter");
  assert.equal(summarizeRule({
    match: { hostnames: ["a", "b", "c", "d", "e"], urlIncludes: [], titleIncludes: [] },
  }), "Hosts: a, b, c, +2 more");
});
