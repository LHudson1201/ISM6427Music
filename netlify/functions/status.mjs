import { suno, json, handle } from "../lib/suno.mjs";

export default handle(async (req) => {
  const url = new URL(req.url);
  const taskId = url.searchParams.get("taskId");
  if (!taskId || !/^[\w-]{4,128}$/.test(taskId)) return json({ error: "Missing or invalid taskId" }, 400);

  const data = await suno(`/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`);
  const tracks = (data?.response?.sunoData || []).map((t) => ({
    id: t.id,
    title: t.title,
    tags: t.tags,
    prompt: t.prompt,
    duration: t.duration,
    imageUrl: t.image_url || t.source_image_url || "",
    audioUrl: t.audio_url || t.source_audio_url || "",
    streamUrl: t.stream_audio_url || t.source_stream_audio_url || "",
    createTime: t.createTime,
  }));

  return json({
    taskId,
    status: data?.status || "PENDING",
    errorMessage: data?.errorMessage || null,
    tracks,
  });
});

export const config = { path: "/api/status" };
