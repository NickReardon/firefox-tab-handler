# Firefox Tab Organizer

A Firefox-first extension for safely consolidating normal browser windows and organizing loose tabs into native tab groups.

The extension plans changes before applying them. It preserves pinned tabs and existing groups by default, works locally, and does not inspect page contents.

See [the MVP plan](docs/mvp-plan.md) for scope and acceptance criteria.

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
