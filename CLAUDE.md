# Claude routing shim — Neyssan

Read `AGENTS.md` first for Neyssan project rules and the shared memory bridge.

For twoweeks/Neyssan memory, the canonical vault path is:

`/Volumes/video/git/twoweeks-wiki` (configured for this environment; configurable if needed, e.g. `../twoweeks-wiki`)

If you prefer portability, treat this as:

`TWOWEEKS_WIKI_PATH` = `/Volumes/video/git/twoweeks-wiki`

Start with:

1. `TWOWEEKS_WIKI_PATH/WIKI_SCHEMA.md`
2. `TWOWEEKS_WIKI_PATH/CLAUDE.md`
3. `TWOWEEKS_WIKI_PATH/wiki/hot.md` if present
4. `TWOWEEKS_WIKI_PATH/wiki/index.md`

If `wiki/hot.md` is missing in a non-canonical worktree, fall back to `TWOWEEKS_WIKI_PATH/WIKI_SCHEMA.md`, then `TWOWEEKS_WIKI_PATH/CLAUDE.md`, then `TWOWEEKS_WIKI_PATH/wiki/overview.md` and `TWOWEEKS_WIKI_PATH/wiki/index.md`.

Do not duplicate or override the vault contract here. `twoweeks-wiki/CLAUDE.md` remains the write-time authority for wiki mutations.
