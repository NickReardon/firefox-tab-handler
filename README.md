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
Rules with the same name share one group.
After Apply, pinned tabs remain first, groups follow, and unmatched unpinned
tabs are placed last in their preserved window and tab order.

Each rule can also list **Don't include** hostnames, URL text, or title text.
A tab that matches an exclusion skips that rule and moves on to the next one,
so a title rule for `unreal engine` can exclude `mail.google.com` and leave
newsletters in the mail group.

### Default and custom rules

The extension ships a default rule set covering communication, docs, AI,
development, research, school, gaming, media, social, news, and shopping
sites. Its order is app sites (mail, chat, docs) first, then topic title
phrases, then content sites, so a topic such as `unreal engine` wins over
YouTube or Reddit but not over Gmail.

Defaults apply until you make your own set, either by copying the defaults or
by starting empty. Once you have a custom set, defaults are ignored entirely
and extension updates never change your rules. From your set you can copy any
default group back in, or revert to defaults, which deletes your set after a
confirmation.

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
shows added, changed, and removed rules before replacing saved rules, and an
import always creates or replaces your custom set. Exports use config version
2, which adds exclusions. Version 1 files still import.

The popup exports a local tab inventory. Query strings and fragments are
removed by default; including them requires the explicit full-URL checkbox.

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
