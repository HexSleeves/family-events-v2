const PORT = Number(process.env.PORT ?? 8080);
const PROXY_API_KEY = process.env.LLM_PROXY_API_KEY ?? "";
const REQUEST_TIMEOUT_MS = Number(process.env.LLM_PROXY_TIMEOUT_MS ?? 45_000);

// Ollama upstream — LLM_UPSTREAM_BASE_URL kept as alias for backward compat
const OLLAMA_BASE_URL = normalizeBaseUrl(
  process.env.LLM_OLLAMA_BASE_URL ?? process.env.LLM_UPSTREAM_BASE_URL ?? "",
);
const OLLAMA_API_KEY =
  process.env.LLM_OLLAMA_API_KEY ?? process.env.LLM_UPSTREAM_API_KEY ?? "ollama";

// OpenAI upstream
const OPENAI_BASE_URL = normalizeBaseUrl(
  process.env.LLM_OPENAI_BASE_URL ?? "https://api.openai.com",
);
const OPENAI_API_KEY = process.env.LLM_OPENAI_API_KEY ?? "";

// Comma-separated model name prefixes that route to OpenAI
const OPENAI_MODEL_PREFIXES = (
  process.env.LLM_OPENAI_MODEL_PREFIXES ?? "gpt-,o1,o3,o4,text-,dall-e-"
)
  .split(",")
  .filter(Boolean);

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

function resolveProvider(model) {
  const isOpenAI = OPENAI_MODEL_PREFIXES.some((p) => model.startsWith(p));
  return isOpenAI
    ? { baseUrl: OPENAI_BASE_URL, apiKey: OPENAI_API_KEY, name: "openai" }
    : { baseUrl: OLLAMA_BASE_URL, apiKey: OLLAMA_API_KEY, name: "ollama" };
}

function buildUpstreamUrl(pathname, search, baseUrl) {
  if (!pathname.startsWith("/v1/")) return null;
  const target = new URL(`${baseUrl}${pathname.slice(3)}`);
  target.search = search;
  return target;
}

async function proxy(req) {
  const url = new URL(req.url);

  if (url.pathname === "/healthz") {
    return json(200, {
      ok: true,
      ollama_configured: Boolean(OLLAMA_BASE_URL),
      openai_configured: Boolean(OPENAI_API_KEY),
      openai_model_prefixes: OPENAI_MODEL_PREFIXES,
    });
  }

  if (!PROXY_API_KEY || getBearerToken(req) !== PROXY_API_KEY) {
    return json(401, { error: "unauthorized" });
  }

  if (!url.pathname.startsWith("/v1/")) {
    return json(404, { error: "only /v1/* routes are proxied" });
  }

  // Buffer body to inspect the model field for routing.
  // Request payloads are small JSON; response body stays streamed.
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const bodyText = hasBody ? await req.text() : "";

  let provider = { baseUrl: OLLAMA_BASE_URL, apiKey: OLLAMA_API_KEY, name: "ollama" };
  if (bodyText) {
    try {
      const { model = "" } = JSON.parse(bodyText);
      if (model) provider = resolveProvider(model);
    } catch {}
  }

  if (!provider.baseUrl) {
    return json(500, {
      error: `No upstream configured for provider "${provider.name}". Set LLM_${provider.name.toUpperCase()}_BASE_URL.`,
    });
  }

  const target = buildUpstreamUrl(url.pathname, url.search, provider.baseUrl);
  if (!target) {
    return json(404, { error: "only /v1/* routes are proxied" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers = new Headers();
    const contentType = req.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);
    headers.set("Authorization", `Bearer ${provider.apiKey}`);

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? bodyText : undefined,
      signal: controller.signal,
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
