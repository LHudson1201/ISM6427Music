import { suno, json, handle, callbackUrl } from "../lib/suno.mjs";

// POST /api/lyrics { prompt }      -> { taskId }
// GET  /api/lyrics?taskId=...      -> { status, lyrics: [{title, text}] }
export default handle(async (req) => {
  if (req.method === "POST") {
    const { prompt } = await req.json().catch(() => ({}));
    const p = typeof prompt === "string" ? prompt.trim().slice(0, 200) : "";
    if (!p) return json({ error: "Describe what the lyrics should be about." }, 400);
    const data = await suno("/api/v1/lyrics", { method: "POST", body: { prompt: p, callBackUrl: callbackUrl(req) } });
    return json({ taskId: data.taskId });
  }

  const taskId = new URL(req.url).searchParams.get("taskId");
  if (!taskId || !/^[\w-]{4,128}$/.test(taskId)) return json({ error: "Missing or invalid taskId" }, 400);
  const data = await suno(`/api/v1/lyrics/record-info?taskId=${encodeURIComponent(taskId)}`);
  const lyrics = (data?.response?.data || [])
    .filter((l) => l.text)
    .map((l) => ({ title: l.title || "", text: l.text }));
  return json({ status: data?.status || "PENDING", errorMessage: data?.errorMessage || null, lyrics });
});

export const config = { path: "/api/lyrics" };
