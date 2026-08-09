/*
 * Lobster Labz Alpha Lab access gate.
 *
 * The game stays in public/ as a static asset, but this Worker runs first for
 * every request. Anonymous visitors receive only the PIN form; the game and
 * its assets are fetched after a short-lived, HMAC-signed session is present.
 *
 * Required runtime secrets (add in Workers & Pages > Settings > Variables &
 * Secrets; never commit them):
 *   LAB_PIN         shared tester PIN
 *   SESSION_SECRET  long random signing secret
 */

const SESSION_COOKIE = "llz_alpha_session";
const SESSION_TTL_SECONDS = 2 * 60 * 60;
const LOGIN_PATH = "/__alpha/login";
const LOGOUT_PATH = "/__alpha/logout";
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 6;

// This is intentionally only a small edge-local brake. It is not a substitute
// for Cloudflare Rate Limiting if this gate is exposed to a large audience.
const failedAttempts = new Map();

const encoder = new TextEncoder();

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function parseCookies(request) {
  const result = {};
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) result[name] = value;
  }
  return result;
}

async function createSession(secret) {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `v1.${expires}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

async function hasValidSession(request, secret) {
  if (!secret) return false;
  const token = parseCookies(request)[SESSION_COOKIE] || "";
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const expires = Number(parts[1]);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000)) return false;
  const payload = `v1.${expires}`;
  const expected = await hmac(secret, payload);
  return safeEqual(parts[2], expected);
}

function clientKey(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

function isRateLimited(key) {
  const now = Date.now();
  const current = failedAttempts.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    failedAttempts.set(key, { startedAt: now, count: 0 });
    return false;
  }
  return current.count >= RATE_LIMIT;
}

function recordFailure(key) {
  const now = Date.now();
  const current = failedAttempts.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    failedAttempts.set(key, { startedAt: now, count: 1 });
    return;
  }
  current.count += 1;
}

function clearFailures(key) {
  failedAttempts.delete(key);
}

function securityHeaders(headers = {}) {
  const result = new Headers(headers);
  result.set("X-Content-Type-Options", "nosniff");
  result.set("X-Frame-Options", "DENY");
  result.set("Referrer-Policy", "no-referrer");
  result.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  result.set("X-Robots-Tag", "noindex, nofollow");
  return result;
}

function htmlResponse(body, status = 200, extraHeaders = {}) {
  const headers = securityHeaders(extraHeaders);
  headers.set("Content-Type", "text/html; charset=UTF-8");
  headers.set("Cache-Control", "no-store, max-age=0");
  return new Response(body, { status, headers });
}

function loginPage(message = "") {
  const notice = message
    ? `<p class="notice" role="alert">${message}</p>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Lobster Labz — Alpha Lab</title>
  <style>
    :root{color-scheme:dark;--ink:#111214;--panel:#1d1e20;--cream:#f4efe5;--muted:#aaa7a0;--rust:#ff5a31;--blue:#7eaef4}
    *{box-sizing:border-box}
    html,body{margin:0;min-height:100%;background:var(--ink);color:var(--cream);font-family:"Courier New",monospace}
    body{display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 15% 15%,#25282d 0,#111214 44%,#090a0b 100%)}
    main{width:min(100%,520px);border:1px solid #696b70;border-radius:18px;background:linear-gradient(145deg,#252629,#151617);padding:clamp(24px,7vw,52px);box-shadow:12px 14px 0 #08090a}
    .mark{display:flex;justify-content:space-between;gap:16px;align-items:center;color:var(--muted);font-size:12px;letter-spacing:2px;text-transform:uppercase}
    .mark b{color:var(--rust);font-size:15px}
    h1{font-family:Impact,"Arial Black",sans-serif;font-size:clamp(40px,11vw,70px);line-height:.9;letter-spacing:1px;margin:46px 0 18px;text-transform:uppercase}
    p{font-family:Arial,sans-serif;line-height:1.55;color:var(--muted);font-size:16px}
    form{margin-top:30px;display:grid;gap:12px}
    label{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--muted)}
    input{width:100%;border:1px solid #777b82;border-radius:8px;background:#0c0d0e;color:var(--cream);padding:14px 15px;font:700 18px/1 "Courier New",monospace;letter-spacing:2px}
    input:focus{outline:2px solid var(--blue);outline-offset:2px}
    button{margin-top:8px;border:2px solid var(--rust);border-radius:8px;background:var(--rust);color:#150d0a;padding:14px 18px;font:900 14px/1 "Courier New",monospace;letter-spacing:2px;text-transform:uppercase;cursor:pointer}
    button:hover{filter:brightness(1.1)}
    .notice{border-left:3px solid var(--rust);padding:10px 12px;margin:20px 0 0;color:#ffd2c7;background:#321914;font-size:14px}
    .fine{margin-top:26px;font-size:12px;letter-spacing:1px}
  </style>
</head>
<body>
  <main>
    <div class="mark"><span>LOBSTER LABZ</span><b>PRIVATE BAY</b></div>
    <h1>Alpha<br>Lab</h1>
    <p>Invited testers: enter the current access PIN to open this experimental build.</p>
    ${notice}
    <form method="post" action="${LOGIN_PATH}">
      <label for="pin">Access PIN</label>
      <input id="pin" name="pin" type="password" inputmode="text" autocomplete="off" spellcheck="false" required autofocus>
      <button type="submit">Enter the lab</button>
    </form>
    <p class="fine">Sessions expire automatically. Do not share the PIN publicly.</p>
  </main>
</body>
</html>`;
}

function redirect(location, cookie) {
  const headers = securityHeaders({ Location: location, "Cache-Control": "no-store, max-age=0" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

function addAssetHeaders(response) {
  const headers = securityHeaders(response.headers);
  // Keep the game behind the Worker gate and out of shared/browser caches.
  headers.set("Cache-Control", "private, no-store, max-age=0");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const secret = env.SESSION_SECRET;

    if (url.pathname === LOGIN_PATH) {
      if (request.method !== "POST") return htmlResponse(loginPage(), 200);
      if (!env.LAB_PIN || !secret) {
        return htmlResponse(loginPage("Alpha access is not configured yet."), 503);
      }

      const key = clientKey(request);
      if (isRateLimited(key)) {
        return htmlResponse(loginPage("Too many attempts. Please wait a few minutes and try again."), 429, { "Retry-After": "600" });
      }

      let supplied = "";
      try {
        const form = await request.formData();
        supplied = String(form.get("pin") || "").trim();
      } catch {
        recordFailure(key);
        return htmlResponse(loginPage("That request could not be read. Try again."), 400);
      }

      if (!safeEqual(supplied, String(env.LAB_PIN))) {
        recordFailure(key);
        return htmlResponse(loginPage("That PIN was not accepted."), 401);
      }

      clearFailures(key);
      const token = await createSession(secret);
      return redirect("/", `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`);
    }

    if (url.pathname === LOGOUT_PATH) return redirect("/", clearSessionCookie());

    if (!(await hasValidSession(request, secret))) {
      return htmlResponse(loginPage());
    }

    if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return htmlResponse("Alpha asset binding is not configured.", 503);
    }

    const asset = await env.ASSETS.fetch(request);
    return addAssetHeaders(asset);
  }
};
