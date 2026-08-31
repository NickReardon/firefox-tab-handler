# MVP Plan

## Product boundary

The MVP has one explicit workflow:

```text
Organize Tabs -> preview -> apply -> undo
```

It consolidates selected normal Firefox windows into the focused normal window, preserves existing native groups, and uses deterministic user rules to organize otherwise loose tabs.

The extension targets Firefox 140+ with Manifest V3. It runs locally and does not send tab data anywhere.

## Milestone 1: API spike

Build the smallest extension that can:

- Snapshot normal, non-private windows, tabs, and native tab groups.
- Identify the focused normal window.
- Move one loose tab with `tabs.move()`.
- Move one existing group with `tabGroups.move()`.

Manual acceptance:

- The snapshot accurately reports windows, tabs, groups, pinned state, active state, container identity, and group metadata.
- A loose tab and an existing group can be moved without recreating their tabs.
- Pinned tabs are never passed to `tabs.group()`.

Status: accepted on 2026-08-30.

- `pnpm test` passes four focused API-spike checks.
- Manual temporary-add-on validation confirmed focused-window detection, pinned and active state, container identity, and native group metadata.
- Cross-window loose-tab and native-group moves preserved tab and group identity; the pinned-tab guard rejected mutation.
- `web-ext lint` reports zero errors and one Android-only minimum-version warning; the desktop build succeeds.
- DevTools owns focus while attached, so focused-window validation uses a delayed snapshot after returning focus to a normal browser window.

## Milestone 2: planning and preview

Create a pure planner:

```text
BrowserSnapshot + Rules -> OrganizationPlan
```

The plan contains the destination window, preserved groups to move, loose-tab moves, new groups, and warnings. The popup renders the plan but cannot mutate Firefox yet.

Planner invariants:

- Ignore private and non-normal windows.
- Every eligible tab appears exactly once.
- Pinned tabs remain ungrouped.
- Existing groups remain intact.
- Track the active tab for restoration.
- Leave unmatched tabs ungrouped.

## Milestone 3: apply and undo

Execute an approved plan in this order:

1. Keep an anchor tab in each source window.
2. Move preserved groups.
3. Move loose tabs.
4. Create groups for rule-matched loose tabs.
5. Validate the resulting layout.
6. Close empty source windows only after validation.
7. Store the pre-apply snapshot for one best-effort undo.

Firefox does not make these operations atomic. Undo restores the captured layout where possible and reports tabs that disappeared or could not be restored.

## Milestone 4: deterministic rules

Store ordered rules in `storage.local`. A rule can match hostname, URL substring, or title keyword, then assign a native group name and color. First matching rule wins.

Rules affect only ungrouped, unpinned tabs. Existing groups always win in safe mode.

The options page supports adding, editing, deleting, and reordering rules.

## Milestone 5: portable configuration and tab inventory

### Rule config import and export

Export a versioned JSON configuration. Import validates the strict schema and previews added, changed, and removed rules before replacing local rules.

```json
{
  "version": 1,
  "rules": [
    {
      "id": "tethered",
      "name": "Tethered",
      "color": "blue",
      "match": {
        "hostnames": ["unrealengine.com", "dev.epicgames.com"],
        "titleIncludes": ["TetheredLyra"]
      }
    }
  ]
}
```

Reject unknown fields, duplicate rule IDs, malformed matchers, and rules with no matcher.

### Tab list export

Export selected normal windows as JSON for manual analysis outside the extension. Include group name, tab title, hostname, sanitized URL, pinned state, and container identity.

Strip query strings and fragments by default. Offer an explicit include-full-URLs toggle because URL paths can be useful for rule authoring and query strings can contain sensitive data.

This export performs no network request. A user may manually paste it into an AI tool and import a reviewed generated rule config afterward.

## Definition of done

- Preview and apply safe cross-window consolidation.
- Preserve pinned tabs, containers, active tab, source ordering, and existing group metadata.
- Create native groups from explicit deterministic rules.
- Provide one immediate best-effort undo.
- Import and export validated rule configurations.
- Export a sanitized tab inventory.
- Request only the permissions needed for tabs, tab groups, and local storage, with private browsing disabled.
- Cover the pure planner with fixtures for mixed windows, pinned tabs, existing groups, duplicate rule matches, and disappearing tabs.
- Pass `web-ext lint` and a manual Firefox test-profile validation.
