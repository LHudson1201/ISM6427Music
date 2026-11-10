import { suno, json, handle } from "../lib/suno.mjs";

export default handle(async () => {
  const credits = await suno("/api/v1/generate/credit");
  return json({ credits });
});

export const config = { path: "/api/credits" };
