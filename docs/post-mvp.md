# Post-MVP

## Deferred features

Deferred work is tracked in [GitHub issues](https://github.com/NickReardon/firefox-tab-handler/issues):

- [#10](https://github.com/NickReardon/firefox-tab-handler/issues/10) Per-tab undo that skips tabs changed since apply.
- [#11](https://github.com/NickReardon/firefox-tab-handler/issues/11) Registrable-domain grouping.
- [#12](https://github.com/NickReardon/firefox-tab-handler/issues/12) Automatic organization of new tabs.
- [#13](https://github.com/NickReardon/firefox-tab-handler/issues/13) Rebuild mode that discards existing groups.
- [#14](https://github.com/NickReardon/firefox-tab-handler/issues/14) Rule import and export beyond the JSON config format.
- [#15](https://github.com/NickReardon/firefox-tab-handler/issues/15) Semantic title similarity grouping.
- [#16](https://github.com/NickReardon/firefox-tab-handler/issues/16) LLM-assisted rule generation or revision.
- [#17](https://github.com/NickReardon/firefox-tab-handler/issues/17) User-provided LLM API that sorts tabs directly.

## Gate for LLM integration

Do not add an LLM API until the deterministic organizer is trusted in daily use. Any future LLM sorting path needs an explicit preview, user approval before tab mutation, and a clear data-transmission disclosure.

## Release baseline

The MVP has a repeatable local release gate and documented privacy, manual
acceptance, signing, and distribution boundaries. Public distribution uses a
listed AMO release, GitHub for source and issues, and a personal site linking to
both. The project uses MPL-2.0 and a permanent UUID-based Gecko ID.
The first signed release remains tracked in
[#9](https://github.com/NickReardon/firefox-tab-handler/issues/9).
