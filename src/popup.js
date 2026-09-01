export function itemLabel(item) {
  if (typeof item !== "object" || item === null) {
    return String(item);
  }

  const title = item.message ?? item.title ?? item.name ?? item.groupTitle;
  const count =
    item.count ?? item.tabCount ?? item.tabIds?.length ?? item.tabMoves?.length;
  const parts = [];

  if (item.requiresMove === true) {
    parts.push("Move");
  } else if (item.requiresMove === false) {
    parts.push("Keep");
  }
  if (title !== undefined && String(title).trim()) {
    parts.push(String(title));
  } else if (Array.isArray(item.tabIds)) {
    parts.push("Untitled group");
  }
  for (const [label, value] of [
    ["ID", item.id],
    ["Group", item.groupId],
    ["Tab", item.tabId],
    ["From window", item.sourceWindowId],
    ["To window", item.destinationWindowId],
  ]) {
    if (value !== undefined) {
      parts.push(`${label} ${value}`);
    }
  }
  if (count !== undefined) {
    parts.push(`${count} tab${count === 1 ? "" : "s"}`);
  }
  if (item.color) {
    parts.push(`Color ${item.color}`);
  }
  if (typeof item.collapsed === "boolean") {
    parts.push(item.collapsed ? "Collapsed" : "Expanded");
  }
  if ("pinned" in item) {
    parts.push(item.pinned ? "Pinned" : "Unpinned");
  }

  return parts.join(" - ") || "Unnamed item";
}

function renderList(selector, items) {
  const list = document.querySelector(selector);
  const values = Array.isArray(items) ? items : [];

  for (const item of values.length ? values : ["None"]) {
    const entry = document.createElement("li");
    entry.textContent = itemLabel(item);
    list.append(entry);
  }
}

async function loadPreview() {
  const status = document.querySelector("#status");
  const preview = document.querySelector("#preview");
  const applyButton = document.querySelector("#apply");
  const undoButton = document.querySelector("#undo");
  const debugLogging = document.querySelector("#debug-logging");
  const result = document.querySelector("#result");

  try {
    const plan = await browser.runtime.sendMessage({ type: "planner:preview" });

    if (!plan || typeof plan !== "object") {
      throw new Error("The planner returned no preview.");
    }

    document.querySelector("#destination").textContent =
      String(plan.destinationWindowId ?? "Unknown");
    document.querySelector("#active-tab").textContent =
      String(plan.activeTabId ?? "None");
    renderList("#preserved-groups", plan.preservedGroups);
    renderList("#loose-moves", plan.looseTabMoves);
    renderList("#new-groups", plan.newGroups);
    renderList("#warnings", plan.warnings);
    undoButton.disabled = !(await browser.runtime.sendMessage({
      type: "planner:undo-available",
    }));
    debugLogging.checked = await browser.runtime.sendMessage({
      type: "logging:get",
    });

    debugLogging.addEventListener("change", async () => {
      debugLogging.disabled = true;

      try {
        debugLogging.checked = await browser.runtime.sendMessage({
          type: "logging:set",
          enabled: debugLogging.checked,
        });
        result.setAttribute("role", "status");
        result.textContent = `Detailed logging ${debugLogging.checked ? "enabled" : "disabled"}.`;
      } catch (error) {
        debugLogging.checked = !debugLogging.checked;
        result.setAttribute("role", "alert");
        result.textContent = `Could not update logging: ${error.message}`;
      } finally {
        debugLogging.disabled = false;
      }
    });

    applyButton.addEventListener("click", async () => {
      applyButton.disabled = true;
      undoButton.disabled = true;
      result.textContent = "Applying plan...";

      try {
        const applied = await browser.runtime.sendMessage({
          type: "planner:apply",
          plan,
        });
        result.textContent = `Applied: ${applied.movedGroups} groups and ${applied.movedTabs} loose tabs moved; ${applied.closedWindows} windows closed.`;
        undoButton.disabled = false;
      } catch (error) {
        result.setAttribute("role", "alert");
        result.textContent = `Apply failed: ${error.message}`;
        undoButton.disabled = !(await browser.runtime.sendMessage({
          type: "planner:undo-available",
        }));
      }
    });

    undoButton.addEventListener("click", async () => {
      applyButton.disabled = true;
      undoButton.disabled = true;
      result.textContent = "Restoring the previous layout...";

      try {
        const undone = await browser.runtime.sendMessage({ type: "planner:undo" });
        const warningText = undone.warnings.length
          ? ` ${undone.warnings.join(" ")}`
          : "";
        result.textContent = `Undo restored ${undone.restoredGroups} groups and ${undone.restoredTabs} loose tabs.${warningText}`;
      } catch (error) {
        result.setAttribute("role", "alert");
        result.textContent = `Undo failed: ${error.message}`;
      }
    });

    status.textContent = "Preview ready. No changes have been made.";
    preview.hidden = false;
  } catch (error) {
    status.setAttribute("role", "alert");
    status.textContent = `Could not load preview: ${error.message}`;
  }
}

if (typeof document !== "undefined") {
  loadPreview();
}
