# v6.3 changed files

Runtime files changed from v6.2:

- `functions/_shared.js` — adds landscape pair output dimensions.
- `functions/api/render.js` — generates front and rear art together in one consistency sheet; legacy single-view routes remain compatible.
- `functions/api/sprite.js` — generates both sprite directions together in one consistency sheet.
- `public/app.js` — requests pair outputs, detects the centre gutter, splits the sheet, and preserves the existing art/sprite/export workflow.
- `public/index.html` — updates workflow and progress wording.
- `public/service-worker.js` — advances the cache identifier so browsers fetch the new bundle.

Project/support files changed:

- `package.json`
- `README.md`
- `TEST_REPORT.md`
- `tests/mock-functions.mjs`

No new Cloudflare binding or secret is required. The existing `[ai] binding = "AI"` configuration remains unchanged.
