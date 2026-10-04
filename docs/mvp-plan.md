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

Status: accepted on 2026-08-31.

- `npm test` passes nine focused planner, preview, routing, and API-spike checks.
- Manual temporary-add-on validation confirmed the destination and active tab, move versus keep classification, pinned state, preserved group metadata, and warning output.
- Opening the preview did not mutate tabs, groups, windows, pinned state, or the active tab.
- Runtime messaging exposes only the read-only preview; the Milestone 1 mutation helpers remain test-only.
- `web-ext lint` reports zero errors and one Android-only minimum-version warning; a clean desktop build succeeds.

## Milestone 3: apply and undo

Execute an approved plan in this order:

1. Keep an anchor tab in each source window.
2. Move preserved groups.
3. Move loose tabs.
4. Create or reuse groups for rule-matched loose tabs.
5. Validate the resulting layout.
6. Close empty source windows only after validation.
7. Store the pre-apply snapshot for one best-effort undo.

Firefox does not make these operations atomic. Undo restores the captured layout where possible and reports tabs that disappeared or could not be restored.

Status: accepted on 2026-09-01.

- `pnpm test` passes 13 focused apply, undo, logging, background-routing, planner, preview, and API-spike checks.
- Manual temporary-add-on validation confirmed apply moved a preserved group and loose tab, restored the active tab, validated the result, and closed the source window only afterward.
- Manual undo recreated the source window, restored the group and loose tab, left 40 already-correct destination tabs unchanged, and completed with no warnings.
- Detailed background logging is opt-in through the popup and records operation stages, identifiers, counts, and failures without tab titles or URLs.
- `web-ext lint` reports zero errors and one Android-only minimum-version warning; a clean desktop build succeeds.

## Milestone 4: deterministic rules

Store ordered rules in `storage.local`. A rule can match hostname, URL substring, or title keyword, then assign a native group name and color. First matching rule wins.

Rules affect only ungrouped, unpinned tabs. Existing groups remain intact unless
multiple groups have the exact rule name, in which case they merge into the
destination group or first matching source group.

The options page supports adding, editing, deleting, and reordering rules.

Status: accepted on 2026-09-01.

- `pnpm test` passes 16 focused rule storage, matching, planning, apply, undo, logging, routing, preview, and API-spike checks.
- Manual temporary-add-on validation confirmed adding, editing, deleting, reordering, and persisting ordered rules.
- Preview and Apply confirmed first-match-wins behavior for loose, unpinned tabs.
- Exact-name existing groups merge into one target while preserving the target color and collapsed state; undo recreates consumed groups where possible.
- `web-ext lint` reports zero errors and one Android-only minimum-version warning; a clean desktop build succeeds.

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

Status: accepted on 2026-09-01.

- `pnpm test` passes 19 focused portability, privacy, rule, planning, apply, undo, logging, routing, preview, and API-spike checks.
- Rule export produces version 1 JSON; import rejects malformed or unknown fields and previews added, changed, and removed rules before replacement.
- Manual temporary-add-on validation produced rule and sanitized tab-inventory downloads suitable for the external AI workflow.
- Inventory export includes group name, title, hostname, sanitized URL, pinned state, and container identity; query strings and fragments require the explicit full-URL toggle.
- Apply places pinned tabs first, groups next, and unmatched unpinned tabs last while preserving their window and tab order.
- `web-ext lint` reports zero errors and one Android-only minimum-version warning; a clean desktop build succeeds.

## Post-milestone additions

### Rule editor and summary popup

The options page edits rules in place, and the popup leads with a count
summary while plan details sit behind a disclosure.

### Tab context actions

Right-clicking tabs offers auto-sort by first matching rule, per-rule moves,
and a link to the full preview.

Decision: context actions apply without a preview. They touch only the
selected tabs in one window, and undo covers them. The full organization
always goes through the popup preview.

### Undo scope

Undo holds one snapshot: the last action, from either the popup or the
context menu. A multi-step history was rejected because each step restores
a captured layout, so undoing an older step would also revert any manual
changes made after it.

After apply, the extension records the window, group, pin state, and
relative order of the affected tabs. If that layout changed before undo, the
popup warns and requires a second click. Tabs opened after apply are not
tracked, so new tabs alone do not trigger the warning. If apply failed
partway, no layout is recorded and undo runs without asking, as recovery.

### Default and custom rules

The extension ships a read-only default rule set in `src/default-rules.js`. It
applies only while the `rules` storage key is absent. Any saved custom set,
including an empty one, replaces the defaults entirely.

Decision: defaults and custom rules are never combined. Layering them would
interleave two orderings and let extension updates silently change how a
customized user's tabs group. Users can still copy any default group into
their set, and reverting deletes the custom set after a confirmation.

### Rule exclusions and config version 2

Each rule has optional exclusions with the same matcher types. A rule matches
when any include matcher hits and no exclude matcher does, and an excluded tab
falls through to the next rule. Exported configs are version 2. Import accepts
version 1 and 2, and rejects `exclude` in a version 1 file.

### Spike helpers removed

The Milestone 1 mutation helpers and their console workflow were removed once
the executor superseded them. `snapshotBrowser` moved to `src/snapshot.js`, so
the release package ships only code the extension calls.

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
