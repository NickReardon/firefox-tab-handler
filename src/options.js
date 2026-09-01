import { getRules, setRules } from "./rules.js";
import {
  createRuleConfig,
  downloadJson,
  parseRuleConfig,
  previewRuleReplacement,
} from "./portable.js";

const list = document.querySelector("#rules");
const status = document.querySelector("#status");
let rules = [];
let pendingRules = null;

function values(textarea) {
  return textarea.value.split("\n").map((value) => value.trim()).filter(Boolean);
}

function readRows() {
  return [...list.children].map((row, index) => ({
    id: rules[index].id,
    name: row.querySelector(".rule-name").value,
    color: row.querySelector(".rule-color").value,
    match: {
      hostnames: values(row.querySelector(".rule-hostnames")),
      urlIncludes: values(row.querySelector(".rule-urls")),
      titleIncludes: values(row.querySelector(".rule-titles")),
    },
  }));
}

function render() {
  list.replaceChildren();

  rules.forEach((rule, index) => {
    const row = document.querySelector("#rule-template").content.firstElementChild.cloneNode(true);
    row.querySelector(".rule-name").value = rule.name;
    row.querySelector(".rule-color").value = rule.color;
    row.querySelector(".rule-hostnames").value = rule.match.hostnames.join("\n");
    row.querySelector(".rule-urls").value = rule.match.urlIncludes.join("\n");
    row.querySelector(".rule-titles").value = rule.match.titleIncludes.join("\n");
    row.querySelector(".move-up").disabled = index === 0;
    row.querySelector(".move-down").disabled = index === rules.length - 1;

    row.querySelector(".move-up").addEventListener("click", () => move(index, -1));
    row.querySelector(".move-down").addEventListener("click", () => move(index, 1));
    row.querySelector(".delete-rule").addEventListener("click", () => remove(index));
    list.append(row);
  });
}

function move(index, offset) {
  rules = readRows();
  const [rule] = rules.splice(index, 1);
  rules.splice(index + offset, 0, rule);
  render();
}

function remove(index) {
  rules = readRows();
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
  });
  render();
});

document.querySelector("#save-rules").addEventListener("click", async () => {
  try {
    rules = await setRules(browser, readRows());
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
  rules = await getRules(browser);
  render();
} catch (error) {
  status.setAttribute("role", "alert");
  status.textContent = `Could not load rules: ${error.message}`;
}
