# Cloudflare deployment settings

This repository is a Cloudflare **Pages** project with Pages Functions and a Workers AI binding.

## Required repository configuration

`wrangler.toml` must contain:

```toml
name = "visualiser-character-studio"
compatibility_date = "2026-07-19"
pages_build_output_dir = "./public"

[ai]
binding = "AI"
```

No external image-generation API key or Cloudflare API token is required as a project secret.

## Recommended Workers Builds settings

- Build command: leave blank
- Deploy command: `npx --yes wrangler@4.112.0 pages deploy public`
- Root directory: repository root
- Build output directory: `public`
- Optional build variable: `SKIP_DEPENDENCY_INSTALL=true`

This project has no runtime npm dependencies. Wrangler is fetched only for the deploy command.

## Optional variables

- `APP_ACCESS_TOKEN`: protects `/api/health`, `/api/render`, and `/api/sprite`
- `ALLOWED_ORIGIN`: comma-separated permitted web origins

No external model key or model-name variable is required; the Workers AI binding supplies the model access.

## GitHub workflow note

This project does not use GitHub Pages. Cloudflare deploys it from the connected GitHub repository. Delete any existing `.github/workflows/pages.yml` file; otherwise GitHub will separately attempt a GitHub Pages deployment and may email failed-run notifications.

## Replacing an older repository version

1. Upload all files from this ZIP, including `functions/`, `public/`, and `wrangler.toml`.
2. Delete any old `package-lock.json` from GitHub.
3. Remove any obsolete external image-provider variables or secrets because they are unused.
4. Clear the Cloudflare build cache.
5. Redeploy.
6. If the browser still shows an old renderer name, clear the site data once or unregister the previous service worker.

Do not use `wrangler deploy`. This project requires `wrangler pages deploy public`.


## Error 3030 handling

No additional binding or secret is needed for error 3030. It is a model-side safety rejection rather than an authentication failure. Version 0.3.0 automatically retries one time with a neutral game-asset prompt and returns a clear 422 response if Cloudflare rejects the second candidate as well.
