import { getRules, setRules } from "./rules.js";

const list = document.querySelector("#rules");
const status = document.querySelector("#status");
let rules = [];

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

try {
  rules = await getRules(browser);
  render();
} catch (error) {
  status.setAttribute("role", "alert");
  status.textContent = `Could not load rules: ${error.message}`;
}
