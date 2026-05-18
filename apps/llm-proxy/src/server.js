const PORT = Number(process.env.PORT ?? 8080);
const UPSTREAM_BASE_URL = normalizeBaseUrl(
  process.env.LLM_UPSTREAM_BASE_URL ?? "",
);
const PROXY_API_KEY = process.env.LLM_PROXY_API_KEY ?? "";
const UPSTREAM_API_KEY = process.env.LLM_UPSTREAM_API_KEY ?? "ollama";
const REQUEST_TIMEOUT_MS = Number(process.env.LLM_PROXY_TIMEOUT_MS ?? 45_000);

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getBearerToken(req) {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? "";
}

function buildUpstreamUrl(req) {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/v1/")) return null;
  const target = new URL(`${UPSTREAM_BASE_URL}${url.pathname.slice(3)}`);
  target.search = url.search;
  return target;
}

async function proxy(req) {
  const url = new URL(req.url);
  if (url.pathname === "/healthz") {
    return json(200, {
      ok: true,
      upstream_configured: Boolean(UPSTREAM_BASE_URL),
    });
  }

  if (!UPSTREAM_BASE_URL) {
    return json(500, { error: "LLM_UPSTREAM_BASE_URL is not configured" });
  }

  if (!PROXY_API_KEY || getBearerToken(req) !== PROXY_API_KEY) {
    return json(401, { error: "unauthorized" });
  }

  const target = buildUpstreamUrl(req);
  if (!target) {
    return json(404, { error: "only /v1/* routes are proxied" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers = new Headers();
    const contentType = req.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);
    headers.set("Authorization", `Bearer ${UPSTREAM_API_KEY}`);

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body:
        req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
      signal: controller.signal,
      duplex: "half",
    });

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(502, { error: message });
  } finally {
    clearTimeout(timeout);
  }
}

DenoGlobal()?.serve
  ? DenoGlobal().serve({ port: PORT }, proxy)
  : globalThis.Bun?.serve
    ? globalThis.Bun.serve({ port: PORT, fetch: proxy })
    : startNode();

function DenoGlobal() {
  return globalThis.Deno;
}

function startNode() {
  import("node:http").then(({ createServer }) => {
    createServer(async (nodeReq, nodeRes) => {
      const origin = `http://${nodeReq.headers.host ?? `localhost:${PORT}`}`;
      const headers = new Headers();
      for (const [key, value] of Object.entries(nodeReq.headers)) {
        if (Array.isArray(value)) {
          headers.set(key, value.join(", "));
        } else if (typeof value === "string") {
          headers.set(key, value);
        }
      }
      const req = new Request(new URL(nodeReq.url ?? "/", origin), {
        method: nodeReq.method,
        headers,
        body:
          nodeReq.method === "GET" || nodeReq.method === "HEAD"
            ? undefined
            : nodeReq,
        duplex: "half",
      });
      const response = await proxy(req);
      nodeRes.writeHead(
        response.status,
        Object.fromEntries(response.headers.entries()),
      );
      if (response.body) {
        await response.body.pipeTo(
          new WritableStream({
            write(chunk) {
              nodeRes.write(chunk);
            },
            close() {
              nodeRes.end();
            },
          }),
        );
      } else {
        nodeRes.end();
      }
    }).listen(PORT);
  });
}
