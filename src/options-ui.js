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
      parts.push(`${label}: ${shortList(values)}`);
    }
  }

  const excluded = excludeValues(rule);
  if (excluded.length) {
    parts.push(`Not: ${shortList(excluded)}`);
  }
  return parts.join(" · ") || "No matchers";
}

const SUMMARY_LIMIT = 3;

function shortList(values) {
  const shown = values.slice(0, SUMMARY_LIMIT).join(", ");
  const hidden = values.length - SUMMARY_LIMIT;
  return hidden > 0 ? `${shown}, +${hidden} more` : shown;
}

export function excludeValues(rule) {
  return [
    ...(rule.exclude?.hostnames ?? []),
    ...(rule.exclude?.urlIncludes ?? []),
    ...(rule.exclude?.titleIncludes ?? []),
  ];
}

export function setRuleCollapsed(row, collapsed) {
  const toggle = row.querySelector(".toggle-rule");
  row.querySelector(".rule-fields").hidden = collapsed;
  row.querySelector(".rule-condensed").hidden = !collapsed;
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.textContent = collapsed ? "Expand" : "Collapse";
}
