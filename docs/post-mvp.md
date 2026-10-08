# Post-MVP

## Deferred features

Deferred work is tracked in [GitHub issues](https://github.com/NickReardon/firefox-tab-handler/issues):

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
acceptance, signing, and distribution boundaries. Mozilla signing remains
blocked on deliberate choices for the permanent Gecko ID ([#4](https://github.com/NickReardon/firefox-tab-handler/issues/4)), source license
([#5](https://github.com/NickReardon/firefox-tab-handler/issues/5)), and listed-versus-unlisted channel ([#6](https://github.com/NickReardon/firefox-tab-handler/issues/6)). The first signed release is
tracked in [#9](https://github.com/NickReardon/firefox-tab-handler/issues/9).
