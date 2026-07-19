# Test report

## Passed

- `npm run verify`
  - JavaScript syntax checks for the browser app and all Pages Functions
  - Mocked Workers AI front-art request
  - Mocked Workers AI rear-art request with three references
  - Mocked front-sprite request
  - Mocked rear-sprite request with two references
  - Simulated Cloudflare 3030 rejection followed by successful automatic retry
  - Simulated two consecutive 3030 rejections normalized to HTTP 422 with code 3030
  - Multipart field naming and serialization checks
  - Health endpoint checks for configured and missing AI bindings
  - Optional `APP_ACCESS_TOKEN` rejection check
- `wrangler pages functions build`
  - Pages Functions compiled successfully with Wrangler 4.112.0
- Static file serving
  - `index.html`, `app.js`, and `service-worker.js` returned HTTP 200
- Reference preparation scan
  - Browser AI copies are fixed at 510×510, white-padded, centred, and exported as PNG
- UI selector integrity
  - Every JavaScript `#id` reference resolves to an element in `index.html`
- Provider migration scan
  - No runtime references remain to OpenAI endpoints, keys, or GPT Image models

## Environment limitation

A live FLUX.2 inference request was not executed in the test container because Wrangler’s Workers AI development binding requires authenticated Cloudflare credentials. The mocked binding uses the documented `env.AI.run()` multipart contract and the Pages Functions bundle compiled successfully.

- Confirmed no `.github/workflows/pages.yml` is included; deployment is handled by Cloudflare Pages Git integration.
