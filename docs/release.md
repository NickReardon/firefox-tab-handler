# Release Guide

## Current boundary

Version `0.2.0` is an unsigned development build. `pnpm run build` produces
`web-ext-artifacts/firefox_tab_organizer-0.2.0.zip` for inspection and Mozilla
submission. Firefox Release and Beta require Mozilla-signed extensions for
permanent installation. See Mozilla's [signing and distribution overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).

Temporary development installation remains supported through `pnpm run run` or
`about:debugging`. A temporary add-on is removed when Firefox restarts. See
Mozilla's [temporary installation guide](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).

## Release gate

From a clean checkout:

```text
pnpm install --frozen-lockfile
pnpm run release:check
```

The gate runs all tests, `web-ext lint`, and the package build. The current
lint result includes one known Android-only warning because Firefox Android 140
predates `data_collection_permissions`; desktop Firefox 140 supports it.

Confirm the ZIP contains only extension runtime files from `src`. Never include
exported tab inventories, generated personal rules, credentials, or local
profiles.

## Manual Firefox acceptance

Use disposable test tabs in a temporary Firefox profile:

1. Confirm preview does not mutate tabs, groups, windows, pinning, or focus.
2. Apply across at least two normal windows with pinned tabs, loose tabs, and existing groups.
3. Confirm pinned tabs remain first, groups follow, and unmatched unpinned tabs are last.
4. Confirm first-match rule priority and exact-name group merging.
5. Undo and confirm source windows, groups, metadata, loose tabs, and focus are restored where possible.
6. Export and re-import rules; verify the added, changed, and removed preview appears before replacement.
7. Export a tab inventory without full URLs and confirm credentials, query strings, and fragments are absent.
8. Enable full URLs and confirm query strings and fragments appear while credentials remain absent.
9. Enable detailed logging and confirm logs contain stages, IDs, and counts but no titles or URLs.
10. Right-click one tab and a multi-tab selection. Confirm auto-sort and per-rule moves affect only the selected tabs, and that undo reverts them.
11. Apply across two windows, then move one tracked tab to another group and pin another. Undo and confirm both stay where you put them, the popup reports 2 skipped tabs, and the remaining tabs return to their source windows. Apply again, move every tab from one source window elsewhere, and confirm undo does not reopen that window.
12. With a fresh profile, confirm the options page shows the defaults read-only and Apply uses them. Copy defaults, edit one rule, save, and confirm defaults no longer apply. Copy one default group back in, then cancel and confirm a revert before accepting one.
13. Add a **Don't include** hostname to a title rule and confirm a matching tab on that host lands in the next matching group instead.
14. Check the toolbar icon on a light and a dark theme.

## Signing and distribution

Before the first signed release:

1. Replace the placeholder Gecko ID with the intentional permanent extension ID. Do not change it after release.
2. Confirm `manifest.json` has the intended version and that it exceeds any previously signed version.
3. Choose and document the source license and distribution channel.
4. Review Mozilla Add-on Policies and submit through AMO as listed or unlisted.
5. Keep AMO API credentials outside the repository and command history.
6. Distribute only the signed XPI returned by Mozilla, never the unsigned build ZIP.

Signing is deliberately not automated until the permanent ID, license, and
listed-versus-unlisted channel are chosen.
