// Shared helpers for talking to sunoapi.org from Netlify Functions.
// The API key lives ONLY in the Netlify environment variable SUNO_API_KEY.

export const SUNO_BASE = process.env.SUNO_API_BASE || "https://api.sunoapi.org";

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function apiKey() {
  const key = process.env.SUNO_API_KEY;
  if (!key) {
    throw Object.assign(new Error("Server is missing SUNO_API_KEY. Add it in Netlify → Site configuration → Environment variables, then redeploy."), { status: 500 });
  }
  return key;
}

// Suno requires a callBackUrl. We point it at our own no-op callback function
// and poll for results instead.
export function callbackUrl(req) {
  const origin = process.env.URL || new URL(req.url).origin;
  return `${origin}/api/callback`;
}

const CODE_MESSAGES = {
  400: "Invalid parameters.",
  401: "Unauthorized — check the SUNO_API_KEY.",
  404: "Invalid request method or path.",
  405: "Rate limit exceeded. Try again shortly.",
  413: "Prompt or style is too long.",
  429: "Insufficient Suno credits.",
  430: "Too many requests. Please wait a moment.",
  455: "Suno is under maintenance. Try again later.",
  500: "Suno server error.",
};

export async function suno(path, { method = "GET", body } = {}) {
  const res = await fetch(`${SUNO_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw Object.assign(new Error(`Suno returned an unexpected response (HTTP ${res.status}).`), { status: 502 });
  }

  if (!res.ok || data.code !== 200) {
    const code = data?.code || res.status;
    const msg = data?.msg && data.msg !== "success" ? data.msg : CODE_MESSAGES[code] || "Request failed.";
    throw Object.assign(new Error(msg), { status: code >= 400 && code < 600 ? code : 502, sunoCode: code });
  }
  return data.data;
}

export function handle(fn) {
  return async (req, context) => {
    try {
      return await fn(req, context);
    } catch (err) {
      return json({ error: err.message || "Unknown error", code: err.sunoCode }, err.status || 500);
    }
  };
}
