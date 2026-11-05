# Cloudflare Alpha Deployment

This branch serves the Lobster Labz alpha build directly, without a password.

## Production layout

- Worker project: `alpha-wf-tester`
- Git production branch: `CFP-V0.39.05-stable`
- Source gameplay branch: `A-test-v0.39.05-SILO-GARDENER-REWORK`
- Custom domain: `alpha.lobsterlabz.com`
- Static game files: `public/`
- Worker entry point: `worker.js`

The Worker serves the game and its assets to every visitor. No PIN, login, or
session cookie is required, so anyone with the alpha URL can open the build.
The existing `noindex, nofollow, noarchive` response header remains in place.

## Cloudflare build settings

- Build command: leave blank
- Deploy command: `npx wrangler deploy`
- Root/path: `/`
- Production branch: `CFP-V0.39.05-stable`
- Non-production branch builds: off

The `workers.dev` hostname and preview URLs are disabled in `wrangler.jsonc`.
Keep `alpha.lobsterlabz.com` as the Worker's Custom Domain.

## Deployment checkpoint

- Game build: `v0.39.05`
- Source gameplay commit: `f09f06cfe3badcf249890e6c29bc7441091aaccf`
- Password requirement removed: `2026-11-05`

The game files are unchanged by the access update.

## Legacy authentication settings

`LAB_PIN` and `SESSION_SECRET` are no longer used or required. Existing values
do not affect access. They may be removed from the Cloudflare Worker settings.

Old `/__alpha/login` and `/__alpha/logout` links redirect to the game and clear
the previous session cookie.
