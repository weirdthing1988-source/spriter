# Visualiser Character Studio v6.3 — Cloudflare Workers AI edition

A GitHub-hosted companion app for creating matched character assets for the SMB D&D Visualiser. Image generation and editing run entirely through the Cloudflare Workers AI binding using:

```text
@cf/black-forest-labs/flux-2-klein-4b
```

No external image-generation API key or project secret is required.

## Character workflow

1. Upload a character image or load a GLB/glTF model.
2. For a model, capture the desired front and optional rear reference angles.
3. Add the character description, pose, style, fidelity, and non-negotiable design details.
4. Generate one wide consistency sheet containing the front and rear three-quarter art together.
5. Let the browser detect the centre gutter, split the sheet, and remove the white background from each view.
6. Convert both approved art views into one matched two-panel sprite sheet and split it automatically.
7. Refine alpha removal, edge softness, opacity, pixel size, outline, and padding in the browser.
8. Download four transparent PNG files, a manifest, or one `.smbsprite` package.

## FLUX.2 reference handling

FLUX.2 Klein supports up to four image references, with reference inputs below 512×512. The browser therefore creates temporary white-padded 510×510 AI reference copies while preserving the original upload and the full-resolution generated downloads. White padding also prevents transparent reference areas from being interpreted unpredictably by the model.

The generated art is requested against a uniform white background. The browser removes only edge-connected background pixels before displaying and exporting the polished art. Sprite background cleanup remains adjustable in Step 3.

The front and rear are now requested in one image rather than in independent generations. This substantially reduces changes to visible features such as horn count, hair mass, cape shape, tail tip, footwear, and proportions. A single front reference still cannot reveal genuinely hidden back construction, so those unseen details remain an informed model inference unless a rear model capture is supplied.

## What is implemented

- Responsive image/model upload UI
- GLB/glTF preview through `<model-viewer>`
- Manual front/rear model-view captures
- Character name, pose, treatment, output size, fidelity, and description controls
- Cloudflare Workers AI multipart image editing
- Single-sheet matched front/rear art workflow to reduce cross-view redesign
- Automatic centre-gutter detection and panel separation
- Single-sheet matched front/rear sprite conversion workflow
- Client-side white-padded reference preparation for FLUX.2 input limits
- One automatic safety-framed retry when Cloudflare returns model error 3030
- Clear 3030 guidance if both the normal and safer retry are rejected
- Automatic edge-connected background removal for polished art
- Adjustable sprite alpha/background cleanup and refinements
- Transparent PNG downloads
- `.smbsprite` JSON package with embedded PNG data
- PWA manifest and network-first service worker

## Repository type

This is a Cloudflare **Pages** project with Pages Functions. It is not a standalone Worker.

Use:

```bash
npx --yes wrangler@4.112.0 pages deploy public
```

Do not use `wrangler deploy`, which expects a standalone Worker entry point or Workers Assets configuration.

## GitHub → Cloudflare Pages deployment

1. Create a GitHub repository and upload the contents of this folder.
2. In Cloudflare, open **Workers & Pages** and create a Pages project connected to the repository.
3. Use:
   - Framework preset: `None`
   - Build command: leave blank
   - Build output directory: `public`
   - Deploy command, when requested: `npx --yes wrangler@4.112.0 pages deploy public`
4. Confirm the repository’s `wrangler.toml` contains:

```toml
[ai]
binding = "AI"
```

5. Optional project variables:
   - `APP_ACCESS_TOKEN`: requires the same token in the app’s Settings dialog
   - `ALLOWED_ORIGIN`: comma-separated permitted browser origins
   - `SKIP_DEPENDENCY_INSTALL=true`: avoids unnecessary dependency installation because the project has no runtime npm packages
6. Redeploy.

The application calls these same-origin Pages Function endpoints:

- `GET /api/health`
- `POST /api/render`
- `POST /api/sprite`

A successful health check displays:

```text
Renderer online · @cf/black-forest-labs/flux-2-klein-4b
```

## GitHub Actions and GitHub Pages

No GitHub Pages workflow is included or required. GitHub stores the repository, while Cloudflare Pages performs the deployment through its Git integration. GitHub Pages cannot run the Pages Functions or the Workers AI binding.

If an older upload contains `.github/workflows/pages.yml`, delete that file or disable its workflow under the repository’s **Actions** tab.

## Local development

No AI key belongs in `.dev.vars`. The Workers AI binding is declared in `wrangler.toml`.

Optional local variables:

```text
APP_ACCESS_TOKEN=
ALLOWED_ORIGIN=http://localhost:8788
```

Run:

```bash
npm run dev
```

Open `http://localhost:8788`.

Local or remote Workers AI availability depends on Wrangler’s current binding support and Cloudflare authentication. The included mock tests do not consume Workers AI usage.

## Tests

Run:

```bash
npm run verify
```

This performs JavaScript syntax checks and mocked endpoint tests covering:

- FLUX.2 model selection
- multipart serialization
- contiguous `input_image_0` through `input_image_3` naming
- one-reference and two-reference art-pair requests
- matched two-reference sprite-pair requests
- landscape pair dimensions and legacy single-view compatibility
- AI binding health status
- optional app-token protection
- automatic recovery from a first simulated Cloudflare 3030 output flag
- normalized 422 response after two simulated 3030 rejections


## Cloudflare safety error 3030

Cloudflare can occasionally reject a generated candidate with:

```text
3030: Your output has been flagged. Please choose another prompt / input image combination
```

This indicates that the Workers AI binding and model call are functioning, but Cloudflare's model-side safety layer rejected the candidate output or the prompt/reference combination. The app now retries once with a shorter, neutral, family-friendly game-asset prompt. If the retry is also rejected, the UI explains that the user should try a neutral single-character reference, a less suggestive pose, or remove anatomy/age wording from the free-text description.

The project does not attempt to disable or bypass Cloudflare's safety system.

## Output sizes

The consistency-first workflow generates one landscape sheet and then splits it into two panels:

- Draft sheet: 1024×768; each view is approximately 512×768
- Standard sheet: 1536×1024; each view is approximately 768×1024
- High sheet: 1920×1280; each view is approximately 960×1280

The exact panel width can vary slightly because the browser searches for the cleanest white centre gutter before splitting. FLUX.2 Klein uses a fixed distilled inference process; these choices change output dimensions rather than model step count.

## `.smbsprite` package

The `.smbsprite` file is JSON with a custom extension and MIME type. It contains:

- character name and description
- front/rear mirror rules
- Visualiser scale and foot anchor
- alpha-cleanup settings
- generation provider and model metadata
- art and sprite treatment metadata
- four embedded PNG data URLs

The current SMB D&D Visualiser does not yet import this format automatically; its package parser remains a separate integration step.

## Security and privacy

- No image-generation key or Cloudflare API token is sent to the browser.
- Workers AI is accessed through the server-side `AI` binding.
- `APP_ACCESS_TOKEN` is optional and should be enabled for private deployments.
- Add Cloudflare Turnstile and rate limiting before sharing a public generation endpoint widely.
- Uploaded references are sent to Workers AI for generation and are not persisted by this project.
