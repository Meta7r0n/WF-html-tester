/*
 * Lobster Labz Alpha Lab static asset handler.
 *
 * The alpha build opens directly without a PIN or session cookie.
 * Keep the existing response headers and no-index policy for this test build.
 */

function securityHeaders(initialHeaders = {}) {
  const headers = new Headers(initialHeaders);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  // Voice chat remains available; unrelated sensitive browser APIs are denied.
  headers.set("Permissions-Policy", "camera=(), geolocation=(), payment=(), usb=()");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return headers;
}

function addAssetHeaders(response) {
  const headers = securityHeaders(response.headers);
  const contentType = headers.get("Content-Type") || "";

  // Keep HTML fresh while allowing browser caching for large models,
  // images, and audio during long mobile/desktop test sessions.
  if (contentType.includes("text/html")) {
    headers.set("Cache-Control", "private, no-store, max-age=0");
  } else {
    headers.set("Cache-Control", "private, max-age=3600, must-revalidate");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Old login/logout links still take testers straight to the game.
    if (url.pathname === "/__alpha/login" || url.pathname === "/__alpha/logout") {
      return new Response(null, {
        status: 303,
        headers: securityHeaders({
          Location: "/",
          "Cache-Control": "no-store, max-age=0",
          "Set-Cookie":
            "llz_alpha_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict",
        }),
      });
    }

    if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return new Response("Alpha asset binding is not configured.", {
        status: 503,
        headers: securityHeaders({
          "Content-Type": "text/plain; charset=UTF-8",
          "Cache-Control": "no-store, max-age=0",
        }),
      });
    }

    const assetResponse = await env.ASSETS.fetch(request);
    return addAssetHeaders(assetResponse);
  },
};
