# Post-MVP

## Deferred features

- User-provided LLM API that directly sorts tabs.
- LLM-assisted rule generation or revision.
- Semantic title similarity.
- Automatic organization of new tabs.
- Registrable-domain grouping.
- Rebuild mode that intentionally discards existing groups.
- Rule import and export beyond the MVP JSON format.
- Per-tab undo that skips tabs moved, regrouped, or pinned since apply, replacing the two-click confirmation.

## Gate for LLM integration

Do not add an LLM API until the deterministic organizer is trusted in daily use. Any future LLM sorting path needs an explicit preview, user approval before tab mutation, and a clear data-transmission disclosure.

## Release baseline

The MVP has a repeatable local release gate and documented privacy, manual
acceptance, signing, and distribution boundaries. Mozilla signing remains
blocked on deliberate choices for the permanent Gecko ID, source license, and
listed-versus-unlisted channel.
