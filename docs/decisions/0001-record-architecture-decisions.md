# ADR 0001: Record architecture decisions in ADRs

## Status

accepted — 2026-06-23

## Context

This project is being built as an assessment. The reviewer cares about *how* decisions were made, not just the end state. There are two failure modes to avoid:

1. **Buried reasoning.** Important decisions (data model, money handling, auth approach, scope cuts) live only in commit messages or — worse — only in the author's head. By the end of the project the diff is dense and the *why* is invisible.
2. **One mega-document.** A single `DECISIONS.md` grows until nobody updates it. Decisions made at week 1 get silently overwritten by decisions made at week 3 with no trace of the transition.

We need a format that captures decisions as they happen, keeps the history, and is cheap enough to actually write.

## Decision

Use ADRs — one short markdown file per decision in `docs/decisions/NNNN-kebab-title.md`, with the four-section format described in [docs/decisions/README.md](README.md).

ADRs are written **at the same time as the code that implements them**, in the same commit where possible. New decisions get new files; reversed decisions get a new ADR that supersedes the old one (the old one stays in place with status `superseded by NNNN`).

The `docs/decisions/README.md` index is updated in the same commit that adds a new ADR.

## Consequences

**Easier:**
- The reviewer can read the project's decision history chronologically by walking the ADR numbers.
- Reversing a decision later leaves an audit trail (old ADR + superseding ADR) instead of a silent overwrite.
- Each ADR is small enough that writing one isn't friction — so it actually happens.

**Harder:**
- Marginally more files. Tolerable.
- Discipline required to actually write an ADR when a real decision is made. Mitigation: ADRs land in the same commit as the code, so it's part of the commit's definition-of-done.

**Out of scope for this format:**
- Day-to-day implementation choices (naming a variable, picking a library version) don't get ADRs.
- Pure scope decisions are documented in [docs/REQUIREMENTS.md](../REQUIREMENTS.md), not here.
