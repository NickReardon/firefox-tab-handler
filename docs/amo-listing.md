# AMO Listing Draft

## Name

Tab Organizer for Firefox

## Summary

Preview, consolidate, and organize Firefox tabs into native groups using deterministic local rules.

## Description

Tab Organizer for Firefox safely consolidates normal browser windows and
organizes loose tabs into Firefox's native tab groups.

- Preview every move before applying it.
- Preserve pinned tabs and existing groups by default.
- Sort with ordered rules that match hostnames, URL text, or title text.
- Merge matching tabs and exact-name groups into an existing destination group.
- Undo the most recent apply operation.
- Import and export rule configurations.
- Export a sanitized tab inventory for building rules.
- Enable detailed local logging without recording tab titles or URLs.

All organization runs locally. The extension makes no network requests and
does not inspect page contents.

## Category

Tabs

## Privacy disclosure

The extension does not collect or transmit data. It reads tab titles and URLs
inside Firefox to build previews and apply organization rules. Rules, the
logging preference, and one undo snapshot are stored locally in Firefox.

Tab inventory export happens only after an explicit user action. Credentials
are always removed. Query strings and fragments are omitted unless the user
explicitly enables full URLs.

## Reviewer notes

No account, payment, remote service, analytics, telemetry, advertising,
affiliate links, or remote code is used. The extension requires Firefox 140 or
newer because it uses native tab groups.

Suggested acceptance flow:

1. Open multiple normal windows containing pinned, grouped, and loose tabs.
2. Open the toolbar popup and inspect the preview.
3. Apply the plan, then use Undo last apply.
4. Open Edit rules to create, reorder, export, and import rules.

## Assets and links still needed

- At least one screenshot showing a useful organization preview.
- At least one screenshot showing the rule editor.
- Personal-site project page URL, replacing the GitHub homepage when ready.
- Ko-fi page URL for AMO's Contributions URL field and the personal-site page.
- Support email, if support should be available outside GitHub Issues.
