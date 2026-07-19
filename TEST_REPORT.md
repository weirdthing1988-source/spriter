# Test report — v6.3 consistency workflow

## Passed

- `npm run verify`
  - JavaScript syntax checks for the browser app and all Pages Functions
  - Mocked one-reference art-pair request for image uploads
  - Mocked two-reference art-pair request for front/rear model captures
  - Mocked two-reference sprite-pair request
  - Landscape pair dimensions for Draft output
  - Legacy single-front endpoint compatibility for older cached clients
  - Explicit left/front and right/back panel prompt checks
  - Exact-feature consistency instruction checks
  - Simulated Cloudflare 3030 rejection followed by successful automatic retry
  - Simulated two consecutive 3030 rejections normalized to HTTP 422 with code 3030
  - Multipart field naming and serialization checks
  - Health endpoint checks for configured and missing AI bindings
  - Optional `APP_ACCESS_TOKEN` rejection check
- `wrangler pages functions build`
  - Pages Functions compiled successfully with Wrangler 4.112.0
- Static project checks
  - No GitHub Pages workflow is included
  - No external image-provider runtime keys, endpoints, or models are present
  - Service-worker cache identifier advanced for the new browser bundle
- Pair-separation logic
  - Browser code searches the central 38–62% of the generated sheet for the lowest-content vertical gutter
  - Both output panels are padded to the same dimensions before background cleanup
  - Synthetic sheet test using the supplied mismatched front/rear outputs located the inserted centre gutter without cropping either source panel

## Main pipeline change

Art and sprite directions are no longer requested as independent model generations. FLUX.2 now draws the front and rear together on one landscape canvas. The browser separates the panels afterward. This gives both directions one shared generation context and reduces design drift in horns, hair, capes, tails, boots, proportions, lighting, and pose phase.

## Remaining model limitation

A front-only reference contains no authoritative information about genuinely hidden rear details. The revised prompt requires conservative inference and locks all visible features, but exact unseen back construction still requires a user-supplied rear model capture or back-view reference.

## Environment limitation

A live FLUX.2 inference request was not executed in the test container because the Workers AI binding requires authenticated Cloudflare credentials. The mocked binding uses the documented `env.AI.run()` multipart contract, and the Pages Functions bundle compiled successfully.
