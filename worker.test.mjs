import worker from "./worker.js";

const env = {
  LAB_PIN: "test-only-1234",
  SESSION_SECRET: "test-only-session-secret-32-bytes-minimum",
  ASSETS: {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      const type = path.endsWith(".glb")
        ? "model/gltf-binary"
        : "text/html; charset=UTF-8";
      return new Response(path.endsWith(".glb") ? "MODEL" : "GAME", {
        status: 200,
        headers: { "Content-Type": type },
      });
    },
  },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const base = "https://alpha.lobsterlabz.com";

const noSecrets = await worker.fetch(new Request(`${base}/`), {
  ASSETS: env.ASSETS,
});
assert(noSecrets.status === 503, "gate must fail closed without secrets");

const anonymousHome = await worker.fetch(new Request(`${base}/`), env);
assert(anonymousHome.status === 200, "anonymous home must show login");
assert((await anonymousHome.text()).includes("Alpha Lab"), "login page missing");

const anonymousAsset = await worker.fetch(
  new Request(`${base}/assets/skeleton_lobster.glb`),
  env
);
assert(
  anonymousAsset.headers.get("Content-Type").startsWith("text/html"),
  "anonymous direct asset request bypassed gate"
);

const wrongLogin = await worker.fetch(
  new Request(`${base}/__alpha/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: base,
    },
    body: "pin=wrong",
  }),
  env
);
assert(wrongLogin.status === 401, "wrong PIN must be rejected");

const crossOriginLogin = await worker.fetch(
  new Request(`${base}/__alpha/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://example.com",
    },
    body: "pin=test-only-1234",
  }),
  env
);
assert(crossOriginLogin.status === 403, "cross-origin login must be rejected");

const acceptedLogin = await worker.fetch(
  new Request(`${base}/__alpha/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: base,
    },
    body: "pin=test-only-1234",
  }),
  env
);
assert(acceptedLogin.status === 303, "correct PIN must redirect");
const setCookie = acceptedLogin.headers.get("Set-Cookie");
assert(setCookie?.includes("Max-Age=86400"), "session must last 24 hours");
assert(setCookie?.includes("HttpOnly"), "session cookie must be HttpOnly");
assert(setCookie?.includes("Secure"), "session cookie must be Secure");
const cookie = setCookie.split(";")[0];

const authenticatedHome = await worker.fetch(
  new Request(`${base}/`, { headers: { Cookie: cookie } }),
  env
);
assert((await authenticatedHome.text()) === "GAME", "game did not unlock");
assert(
  authenticatedHome.headers.get("X-Frame-Options") === "DENY",
  "game must not be embedded in an iframe"
);

const authenticatedAsset = await worker.fetch(
  new Request(`${base}/assets/skeleton_lobster.glb`, {
    headers: { Cookie: cookie },
  }),
  env
);
assert((await authenticatedAsset.text()) === "MODEL", "asset did not unlock");
assert(
  authenticatedAsset.headers.get("Cache-Control").includes("private"),
  "asset must not enter a shared cache"
);

console.log("Worker gate tests passed");
