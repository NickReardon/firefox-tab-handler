export function rulesChanged(savedRulesJson, currentRules) {
  return savedRulesJson !== JSON.stringify(currentRules);
}

export function summarizeRule(rule) {
  const parts = [];
  for (const [label, values] of [
    ["Hosts", rule.match.hostnames],
    ["URLs", rule.match.urlIncludes],
    ["Titles", rule.match.titleIncludes],
  ]) {
    if (values.length) {
      parts.push(`${label}: ${values.join(", ")}`);
    }
  }
  return parts.join(" · ") || "No matchers";
}

export function setRuleCollapsed(row, collapsed) {
  const toggle = row.querySelector(".toggle-rule");
  row.querySelector(".rule-fields").hidden = collapsed;
  row.querySelector(".rule-condensed").hidden = !collapsed;
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.textContent = collapsed ? "Expand" : "Collapse";
}
