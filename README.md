# Firefox Tab Organizer

A Firefox-first extension for safely consolidating normal browser windows and organizing loose tabs into native tab groups.

The extension plans changes before applying them. It preserves pinned tabs and existing groups by default, works locally, and does not inspect page contents.

See [the MVP plan](docs/mvp-plan.md) for scope and acceptance criteria.

## Install for development

Run `pnpm install --frozen-lockfile`, then either:

- Run `pnpm run run` to launch Firefox with a temporary profile.
- Open `about:debugging`, choose **This Firefox**, choose **Load Temporary Add-on**, and select `src/manifest.json`.

Temporary add-ons are removed when Firefox restarts. The ZIP produced by
`pnpm run build` is unsigned and is not a permanent-install release artifact.
See [the release guide](docs/release.md) before distributing it.

## Rules

Open **Edit rules** from the extension popup. Rules run from top to bottom and
the first match wins. Each rule assigns loose, unpinned tabs to a native group
by exact hostname, URL text, or title text. Existing groups remain intact.
If the destination already has a group with the exact rule name, matching tabs
and other exact-name groups join it, retaining its color and collapsed state.
After Apply, pinned tabs remain first, groups follow, and unmatched unpinned
tabs are placed last in their preserved window and tab order.

## Tab context menu

Right-click a tab, or a selection of tabs, for quick actions:

- **Auto-sort into groups** groups the selected loose tabs by their first
  matching rule.
- **Move tab into X** moves the selected tabs that match rule X into that
  group, including tabs from other groups.
- **Preview full plan** opens the popup.

Context actions apply immediately because they touch only the selected tabs in
one window. The full organization always shows a preview first.

## Undo

Undo reverts the last action only, whether it came from the popup or the
context menu. It restores the layout captured before that action. If tabs it
tracks were moved, grouped, pinned, or closed afterward, the popup warns that
undo may revert those changes and asks for a second click to proceed.

## Import and export

Rule configurations can be exported and imported from the options page. Import
shows added, changed, and removed rules before replacing saved rules.

[`examples/starter-rules.json`](examples/starter-rules.json) is a
general-purpose starting set covering communication, AI, docs, development,
research, school, gaming, media, social, news, and shopping sites. Importing it
replaces all saved rules, so export yours first to keep them.

The popup exports a local tab inventory. Query strings and fragments are
removed by default; including them requires the explicit full-URL checkbox.

## API spike

Load `src` as a temporary add-on, open its background console, then inspect or
move one item with:

```js
window.spike = await import(browser.runtime.getURL("spike.js"));
await window.spike.snapshotBrowser(browser);
await window.spike.moveLooseTab(browser, tabId, destinationWindowId);
await window.spike.moveExistingGroup(browser, groupId, destinationWindowId);
```

Use IDs from the snapshot. Test moves only from source windows that contain a
tab outside the item being moved so Firefox does not close the source window.

## Debug logging

Use the **Detailed background logging** checkbox in the extension popup. The
setting persists across extension and browser restarts.

Logs include operation stages, browser object IDs, counts, and failures. They do
not include tab titles or URLs.

## Privacy and permissions

The extension runs locally and makes no network requests. It uses `tabs` and
`tabGroups` to preview and apply organization, `menus` for the tab context menu, and
`storage` for rules, logging preference, and one undo snapshot. Private browsing is disabled.

Tab titles and URLs remain inside Firefox unless the user explicitly downloads
a tab inventory. Inventory URLs omit credentials, query strings, and fragments
by default. The full-URL checkbox includes query strings and fragments, but
credentials remain removed.
