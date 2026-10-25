@AGENTS.md

## Claude Code specifics

- Talk to the owner in Ukrainian; keep code, comments and commit messages in English.
- Larger features follow the superpowers flow: brainstorming → spec in `docs/superpowers/specs/` →
  plan in `docs/superpowers/plans/` → implementation with TDD. Specs and plans are kept as history.
- Verify UI changes in the browser pane against an **isolated** server, never the owner's :3000 one.
  Sign in with the made-up token only:

  ```bash
  DATA_DIR=<scratchpad>/ui-data NEXT_DIST_DIR=.next-smoke PORT=3200 API_TOKEN=<made-up> AUTH_SECRET=<made-up> \
    AUTH_URL=http://localhost:3200 NEXTAUTH_URL=http://localhost:3200 AUTH_TRUST_HOST=true npx next dev -p 3200
  ```

  Afterwards kill every pid on :3200, remove `.next-smoke`, `git checkout tsconfig.json`.

- Long command output (jest, playwright, lint) goes to a file in the scratchpad; read its tail.
- Use `/usr/bin/grep` when you need gitignored files: the default `grep` alias skips them.
- Don't spawn subagents unless the owner asks.
