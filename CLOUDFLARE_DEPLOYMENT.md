# Cloudflare Alpha Deployment

This branch is the protected Cloudflare Worker build for Lobster Labz alpha testing.

## Production layout

- Worker project: `alpha-wf-tester`
- Git production branch: `CFP-V0.39.03-stable`
- Source gameplay branch: `A-test-v0.39.03-SILOS-GLIZZY-GAT`
- Custom domain: `alpha.lobsterlabz.com`
- Static game files: `public/`
- Worker entry point: `worker.js`

The Worker runs before every static request. Visitors without a valid signed session receive only the PIN form; direct requests for HTML, models, images, and audio are protected by the same gate.

## Required encrypted secrets

Add both values as Cloudflare **Secret** variables, never plaintext variables:

- `LAB_PIN`: the current shared tester PIN
- `SESSION_SECRET`: a separate random signing value of at least 32 bytes

Do not commit `.dev.vars`, `.env`, either secret, or screenshots containing their values.

## Cloudflare build settings

- Build command: leave blank
- Deploy command: `npx wrangler deploy`
- Root/path: `/`
- Production branch: `CFP-V0.39.03-stable`
- Non-production branch builds: off

The `workers.dev` hostname and preview URLs are disabled in `wrangler.jsonc`. Keep `alpha.lobsterlabz.com` as the Worker's Custom Domain.

## Deployment checkpoint

- Protected build: `v0.39.03`
- Source commit: `83a9c281569e6801859e9de3695f531d327b6282`
- Prepared: `2026-08-16`

## Session behavior

A successful login creates a signed, `HttpOnly`, `Secure`, host-only cookie lasting 24 hours. The tester can keep playing for hours without interruption. Rotating `LAB_PIN` blocks new logins; rotating `SESSION_SECRET` also invalidates all existing sessions immediately.

Logout endpoint: `/__alpha/logout`

