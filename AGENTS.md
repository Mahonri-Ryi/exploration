# Aetheris agent notes

## Playtest in the live game

Every feature you implement must be tested **individually in the actual running game**. Start `npm run dev`, open http://localhost:5173, Found City, and exercise that feature by itself in the live UI (tool, HUD, world, toasts). Unit tests are not enough. If a feature has several parts, test each part separately. Extend `npm run smoke` with a named check for the new feature. Do not ship something that was never opened in the browser.

## Auto commit and merge

When you finish updates, commit, push, open or update a PR, and **merge it into `main`**. Do this every time. Do not wait to be asked. This is standing permission to merge. Prefer a merge commit (`gh pr merge --merge`). Skip only if the turn had no repo changes. If merge is blocked, fix and merge.

## Slack: notify `#city-builder` after every update

When you finish adding updates (code, assets, docs, hosting, or rules), post to Slack **`#city-builder`** (`C0BQC5201PV`) with Slack MCP `slack_send_message` before ending the turn. Do this every time. Do not wait to be asked. Skip only if the turn had no repo changes.

Keep the message short: what shipped, how to open the game, and the PR if there is one (`https://github.com/Mahonri-Ryi/exploration/pull/2`). Return the Slack message link to the user.
