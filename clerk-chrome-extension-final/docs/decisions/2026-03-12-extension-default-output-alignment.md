# Extension Default Output Alignment

Date: 2026-03-12

## Decision

Align direct extension generation with Proposal Forge's default output intent by changing the extension's hidden default `proposalType` from `technical` to `cover_letter`.

## Scope

- Keep the extension UI unchanged.
- Keep one-click generation unchanged.
- Do not change model defaults.
- Do not change auth, scraping, CV flow, or tone behavior.

## Reason

The main remaining coherence gap was the extension's legacy direct-generation default, which still mapped to a freelance/technical proposal shape while Proposal Forge defaulted to an employment cover letter.
