import { suno, json, handle, callbackUrl } from "../lib/suno.mjs";

const MODELS = ["V6", "V6_WILD", "V6_MINI"];

const clampNum = (v, min, max, step) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const c = Math.min(max, Math.max(min, n));
  return step ? Math.round(c / step) * step : c;
};
const str = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

export default handle(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const input = await req.json().catch(() => ({}));

  const customMode = !!input.customMode;
  const instrumental = !!input.instrumental;
  const model = MODELS.includes(input.model) ? input.model : "V6";

  const body = { customMode, instrumental, model, callBackUrl: callbackUrl(req) };

  if (customMode) {
    body.title = str(input.title, 80);
    body.style = str(input.style, 1000);
    if (!instrumental) body.lyrics = str(input.lyrics, 5000);
    body.negativeTags = str(input.negativeTags, 1000);
    if (input.vocalGender === "m" || input.vocalGender === "f") body.vocalGender = input.vocalGender;
    if (input.duration !== undefined && input.duration !== "") body.duration = clampNum(input.duration, 10, 360, 1);
    if (input.styleWeight !== undefined) body.styleWeight = clampNum(input.styleWeight, 0, 1, 0.01);
    if (input.weirdnessConstraint !== undefined) body.weirdnessConstraint = clampNum(input.weirdnessConstraint, 0, 1, 0.01);
    if (input.variety !== undefined) body.variety = clampNum(input.variety, 0, 4, 1);

    if (!body.style && !body.lyrics && !body.negativeTags) {
      return json({ error: "Custom mode needs at least a style, lyrics, or tags to exclude." }, 400);
    }
  } else {
    body.prompt = str(input.prompt, 3000);
    body.style = str(input.style, 1000);
    if (!body.prompt && !body.style) {
      return json({ error: "Describe the song you want to create." }, 400);
    }
  }

  // Drop undefined keys so we never send fields the API rejects.
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

  const data = await suno("/api/v1/generate", { method: "POST", body });
  return json({ taskId: data.taskId });
});

export const config = { path: "/api/generate" };
