# Cloudflare Alpha Deployment

This branch is the protected Cloudflare Worker build for Lobster Labz alpha testing.

## Production layout

- Worker project: `alpha-wf-tester`
- Git production branch: `CFP-V0.27-stable`
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
- Production branch: `CFP-V0.27-stable`
- Non-production branch builds: off

The `workers.dev` hostname and preview URLs are disabled in `wrangler.jsonc`. Add `alpha.lobsterlabz.com` as the Worker's Custom Domain after the first deployment and after both secrets have been configured.

## Session behavior

A successful login creates a signed, `HttpOnly`, `Secure`, host-only cookie lasting 24 hours. The tester can keep playing for hours without interruption. Rotating `LAB_PIN` blocks new logins; rotating `SESSION_SECRET` also invalidates all existing sessions immediately.

Logout endpoint: `/__alpha/logout`
