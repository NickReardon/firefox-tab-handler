import {
  clearCustomRules,
  copyDefaultGroup,
  defaultGroups,
  getDefaultRules,
  getRuleState,
  setRules,
} from "./rules.js";
import {
  excludeValues,
  rulesChanged,
  setRuleCollapsed,
  summarizeRule,
} from "./options-ui.js";
import {
  createRuleConfig,
  downloadJson,
  parseRuleConfig,
  previewRuleReplacement,
} from "./portable.js";

const list = document.querySelector("#rules");
const status = document.querySelector("#status");
let rules = [];
// False while the shipped defaults apply. They are shown read-only.
let custom = false;
let pendingRules = null;
let savedRulesJson = null;
const collapsedRuleIds = new Set();

function values(textarea) {
  return textarea.value.split("\n").map((value) => value.trim()).filter(Boolean);
}

function readRows() {
  return readRowsFrom(...list.children);
}

function readRowsFrom(...rows) {
  return rows.map((row) => ({
    id: row.dataset.ruleId,
    name: row.querySelector(".rule-name").value,
    color: row.querySelector(".rule-color").value,
    match: {
      hostnames: values(row.querySelector(".rule-hostnames")),
      urlIncludes: values(row.querySelector(".rule-urls")),
      titleIncludes: values(row.querySelector(".rule-titles")),
    },
    exclude: {
      hostnames: values(row.querySelector(".rule-exclude-hostnames")),
      urlIncludes: values(row.querySelector(".rule-exclude-urls")),
      titleIncludes: values(row.querySelector(".rule-exclude-titles")),
    },
  }));
}

function showStatus(message, role = "status") {
  status.setAttribute("role", role);
  status.textContent = message;
}

function render() {
  list.replaceChildren();

  rules.forEach((rule, index) => {
    const row = document.querySelector("#rule-template").content.firstElementChild.cloneNode(true);
    row.dataset.ruleId = rule.id;
    row.querySelector(".rule-name").value = rule.name;
    row.querySelector(".rule-color").value = rule.color;
    row.querySelector(".rule-hostnames").value = rule.match.hostnames.join("\n");
    row.querySelector(".rule-urls").value = rule.match.urlIncludes.join("\n");
    row.querySelector(".rule-titles").value = rule.match.titleIncludes.join("\n");
    row.querySelector(".rule-exclude-hostnames").value = rule.exclude.hostnames.join("\n");
    row.querySelector(".rule-exclude-urls").value = rule.exclude.urlIncludes.join("\n");
    row.querySelector(".rule-exclude-titles").value = rule.exclude.titleIncludes.join("\n");
    const name = row.querySelector(".rule-name");
    const summary = row.querySelector(".rule-summary");
    const colorSummary = row.querySelector(".rule-color-summary");
    const condensed = row.querySelector(".rule-condensed");
    const toggle = row.querySelector(".toggle-rule");
    const fields = row.querySelector(".rule-fields");
    const fieldsId = `rule-fields-${index}`;
    fields.id = fieldsId;
    toggle.setAttribute("aria-controls", fieldsId);
    const updateSummary = () => {
      const color = row.querySelector(".rule-color").value;
      summary.textContent = name.value.trim() || "Untitled rule";
      colorSummary.textContent = color;
      row.style.borderLeftColor = color;
      const [current] = readRowsFrom(row);
      condensed.textContent = summarizeRule(current);
      row.querySelector(".exclude-count").textContent = String(excludeValues(current).length);
    };
    updateSummary();
    setRuleCollapsed(row, collapsedRuleIds.has(rule.id));
    row.querySelector(".move-up").disabled = index === 0;
    row.querySelector(".move-down").disabled = index === rules.length - 1;
    row.querySelector(".rule-exclude").open = excludeValues(rule).length > 0;
    for (const control of row.querySelectorAll(".rule-fields input, .rule-fields select, .rule-fields textarea")) {
      control.disabled = !custom;
    }
    for (const button of row.querySelectorAll(".move-up, .move-down, .delete-rule")) {
      button.hidden = !custom;
    }

    fields.addEventListener("input", () => {
      updateSummary();
      updateUnloadGuard();
    });
    toggle.addEventListener("click", () => {
      const collapsed = !collapsedRuleIds.has(rule.id);
      if (collapsed) {
        collapsedRuleIds.add(rule.id);
      } else {
        collapsedRuleIds.delete(rule.id);
      }
      setRuleCollapsed(row, collapsed);
    });
    row.querySelector(".move-up").addEventListener("click", () => move(index, -1));
    row.querySelector(".move-down").addEventListener("click", () => move(index, 1));
    row.querySelector(".delete-rule").addEventListener("click", () => remove(index));
    list.append(row);
  });

  renderMode();
  renderDefaultGroups();
  updateUnloadGuard();
}

function renderMode() {
  const heading = document.createElement("strong");
  heading.textContent = custom ? "Using your rules." : "Using default rules.";
  document.querySelector("#mode-text").replaceChildren(
    heading,
    custom
      ? " Default rules are ignored while you have your own set."
      : " These ship with the extension and update with it. Copy them or start empty to make your own set.",
  );
  for (const id of ["#add-rule", "#save-rules", "#revert-defaults"]) {
    document.querySelector(id).hidden = !custom;
  }
  for (const id of ["#copy-defaults", "#start-empty"]) {
    document.querySelector(id).hidden = custom;
  }
}

function renderDefaultGroups() {
  const section = document.querySelector("#default-groups");
  const groupList = document.querySelector("#default-group-list");
  section.hidden = !custom;
  groupList.replaceChildren();

  if (!custom) {
    return;
  }

  for (const group of defaultGroups(readRows())) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    const name = document.createElement("strong");
    const detail = document.createElement("small");
    const copy = document.createElement("button");

    item.style.borderLeftColor = group.color;
    name.textContent = group.name;
    detail.textContent = `${group.ruleCount} rule${group.ruleCount === 1 ? "" : "s"}` +
      (group.copied ? " - already in your rules" : "");
    label.append(name, " ", detail);
    copy.type = "button";
    copy.textContent = group.copied ? "Copied" : "Copy to my rules";
    copy.disabled = group.copied;
    copy.addEventListener("click", () => copyGroup(group.name));
    item.append(label, copy);
    groupList.append(item);
  }
}

function copyGroup(groupName) {
  const result = copyDefaultGroup(readRows(), groupName);
  rules = result.rules;
  render();

  const copied = `Copied ${result.added} rule${result.added === 1 ? "" : "s"} from ${groupName} to the end of your list.`;
  const skipped = result.skipped ? ` Skipped ${result.skipped} you already have.` : "";
  showStatus(`${copied}${skipped} Move them up if they should win earlier, then save.`);
}

async function loadRules() {
  ({ custom, rules } = await getRuleState(browser));
  savedRulesJson = JSON.stringify(rules);
  collapsedRuleIds.clear();
  if (!custom) {
    rules.forEach((rule) => collapsedRuleIds.add(rule.id));
  }
  render();
}

function confirmUnsavedChanges(event) {
  event.preventDefault();
  event.returnValue = true;
}

function updateUnloadGuard() {
  const hasUnsavedChanges = savedRulesJson !== null && rulesChanged(savedRulesJson, readRows());
  if (hasUnsavedChanges) {
    window.addEventListener("beforeunload", confirmUnsavedChanges);
  } else {
    window.removeEventListener("beforeunload", confirmUnsavedChanges);
  }
}

function setAllCollapsed(collapsed) {
  rules = readRows();
  collapsedRuleIds.clear();
  if (collapsed) {
    rules.forEach((rule) => collapsedRuleIds.add(rule.id));
  }
  render();
}

function move(index, offset) {
  rules = readRows();
  const [rule] = rules.splice(index, 1);
  rules.splice(index + offset, 0, rule);
  render();
}

function remove(index) {
  rules = readRows();
  collapsedRuleIds.delete(rules[index].id);
  rules.splice(index, 1);
  render();
}

document.querySelector("#add-rule").addEventListener("click", () => {
  rules = readRows();
  rules.push({
    id: crypto.randomUUID(),
    name: "",
    color: "grey",
    match: { hostnames: [], urlIncludes: [], titleIncludes: [] },
    exclude: { hostnames: [], urlIncludes: [], titleIncludes: [] },
  });
  render();
});

document.querySelector("#copy-defaults").addEventListener("click", async () => {
  try {
    await setRules(browser, getDefaultRules());
    await loadRules();
    showStatus("Default rules copied. You can now edit them.");
  } catch (error) {
    showStatus(`Could not copy default rules: ${error.message}`, "alert");
  }
});

document.querySelector("#start-empty").addEventListener("click", async () => {
  try {
    await setRules(browser, []);
    await loadRules();
    showStatus("Started an empty rule set. Nothing is sorted until you add rules.");
  } catch (error) {
    showStatus(`Could not start an empty rule set: ${error.message}`, "alert");
  }
});

document.querySelector("#revert-defaults").addEventListener("click", async () => {
  const count = JSON.parse(savedRulesJson).length;
  const confirmed = window.confirm(
    `Delete your ${count} rule${count === 1 ? "" : "s"} and switch to the default rules? ` +
      "This can't be undone. Export your rules first to keep a copy.",
  );

  if (!confirmed) {
    return;
  }

  try {
    await clearCustomRules(browser);
    await loadRules();
    showStatus("Your rules were deleted. Default rules now apply.");
  } catch (error) {
    showStatus(`Could not revert to default rules: ${error.message}`, "alert");
  }
});

document.querySelector("#collapse-all").addEventListener("click", () => setAllCollapsed(true));
document.querySelector("#expand-all").addEventListener("click", () => setAllCollapsed(false));

document.querySelector("#save-rules").addEventListener("click", async () => {
  try {
    rules = await setRules(browser, readRows());
    savedRulesJson = JSON.stringify(rules);
    status.setAttribute("role", "status");
    status.textContent = "Rules saved.";
    render();
  } catch (error) {
    status.setAttribute("role", "alert");
    status.textContent = `Could not save rules: ${error.message}`;
  }
});

document.querySelector("#export-rules").addEventListener("click", () => {
  try {
    downloadJson("firefox-tab-organizer-rules.json", createRuleConfig(readRows()));
    status.setAttribute("role", "status");
    status.textContent = "Rules exported.";
  } catch (error) {
    status.setAttribute("role", "alert");
    status.textContent = `Could not export rules: ${error.message}`;
  }
});

document.querySelector("#import-file").addEventListener("change", async (event) => {
  const preview = document.querySelector("#import-preview");
  const apply = document.querySelector("#apply-import");
  pendingRules = null;
  apply.disabled = true;
  preview.hidden = true;

  try {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    const config = parseRuleConfig(await file.text());
    const changes = previewRuleReplacement(rules, config.rules);

    for (const [key, items] of Object.entries(changes)) {
      const list = document.querySelector(`#import-${key}`);
      list.replaceChildren();
      for (const rule of items.length ? items : [{ id: "None", name: "" }]) {
        const item = document.createElement("li");
        item.textContent = rule.name ? `${rule.name} (${rule.id})` : rule.id;
        list.append(item);
      }
    }

    pendingRules = config.rules;
    apply.disabled = false;
    preview.hidden = false;
    status.setAttribute("role", "status");
    status.textContent = "Import preview ready. Saved rules are unchanged.";
  } catch (error) {
    status.setAttribute("role", "alert");
    status.textContent = `Could not import rules: ${error.message}`;
  }
});

document.querySelector("#apply-import").addEventListener("click", async () => {
  if (!pendingRules) {
    return;
  }

  try {
    rules = await setRules(browser, pendingRules);
    custom = true;
    savedRulesJson = JSON.stringify(rules);
    pendingRules = null;
    document.querySelector("#apply-import").disabled = true;
    render();
    status.setAttribute("role", "status");
    status.textContent = "Imported rules replaced the saved rules.";
  } catch (error) {
    status.setAttribute("role", "alert");
    status.textContent = `Could not replace rules: ${error.message}`;
  }
});

try {
  await loadRules();
} catch (error) {
  status.setAttribute("role", "alert");
  status.textContent = `Could not load rules: ${error.message}`;
}
