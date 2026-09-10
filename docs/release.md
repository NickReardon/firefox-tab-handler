# Release Guide

## Current boundary

Version `0.1.0` is an unsigned development build. `pnpm run build` produces
`web-ext-artifacts/firefox_tab_organizer-0.1.0.zip` for inspection and Mozilla
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
