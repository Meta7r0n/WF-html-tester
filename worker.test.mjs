import assert from "node:assert/strict";
import worker from "./worker.js";

const requests = [];
const env = {
  ASSETS: {
    async fetch(request) {
      requests.push(request);
      const path = new URL(request.url).pathname;
      if (path === "/missing") {
        return new Response("Not found", { status: 404 });
      }
      const model = path.endsWith(".glb");
      return new Response(
        request.method === "HEAD" ? null : model ? "MODEL" : "GAME",
        {
          status: request.headers.has("Range") ? 206 : 200,
          headers: {
            "Content-Type": model
              ? "model/gltf-binary"
              : "text/html; charset=UTF-8",
            ...(request.headers.has("Range")
              ? { "Content-Range": "bytes 0-4/5" }
              : {}),
          },
        }
      );
    },
  },
};
const base = "https://alpha.lobsterlabz.com";

const anonymousHome = await worker.fetch(new Request(base), env);
assert.equal(anonymousHome.status, 200);
assert.equal(await anonymousHome.text(), "GAME", "game must open without secrets or a cookie");
assert.equal(anonymousHome.headers.get("Set-Cookie"), null);
assert.equal(anonymousHome.headers.get("Vary"), null);
assert.equal(anonymousHome.headers.get("X-Frame-Options"), "DENY");
assert.equal(anonymousHome.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
assert.match(anonymousHome.headers.get("Cache-Control"), /no-store/);

const anonymousAsset = await worker.fetch(
  new Request(`${base}/assets/skeleton_lobster.glb`),
  env
);
assert.equal(await anonymousAsset.text(), "MODEL", "assets must load without a cookie");
assert.equal(anonymousAsset.headers.get("Content-Type"), "model/gltf-binary");

const staleSession = await worker.fetch(
  new Request(base, { headers: { Cookie: "llz_alpha_session=expired" } }),
  env
);
assert.equal(await staleSession.text(), "GAME", "old cookies must not block access");

const oldSecrets = await worker.fetch(new Request(base), {
  ...env,
  LAB_PIN: "unused-old-pin",
  SESSION_SECRET: "unused-old-secret",
});
assert.equal(await oldSecrets.text(), "GAME", "old configured secrets must not restore the gate");

for (const path of ["/__alpha/login", "/__alpha/logout"]) {
  for (const method of ["GET", "POST"]) {
    const response = await worker.fetch(
      new Request(`${base}${path}`, { method }),
      env
    );
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/");
    assert.match(response.headers.get("Set-Cookie"), /llz_alpha_session=; Max-Age=0/);
  }
}

const head = new Request(`${base}/assets/skeleton_lobster.glb`, { method: "HEAD" });
const headResponse = await worker.fetch(head, env);
assert.equal(requests.at(-1), head, "original method and headers must reach the asset binding");
assert.equal(await headResponse.text(), "");

const rangeResponse = await worker.fetch(
  new Request(`${base}/assets/skeleton_lobster.glb`, { headers: { Range: "bytes=0-4" } }),
  env
);
assert.equal(rangeResponse.status, 206);
assert.equal(rangeResponse.headers.get("Content-Range"), "bytes 0-4/5");

const missingAsset = await worker.fetch(new Request(`${base}/missing`), env);
assert.equal(missingAsset.status, 404);
assert.equal(await missingAsset.text(), "Not found");

const missingBinding = await worker.fetch(new Request(base), {});
assert.equal(missingBinding.status, 503);
assert.equal(await missingBinding.text(), "Alpha asset binding is not configured.");
assert.match(missingBinding.headers.get("Cache-Control"), /no-store/);

console.log("Password-free alpha Worker tests passed");
