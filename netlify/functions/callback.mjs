// Suno requires a callBackUrl. The app polls /api/status for results,
// so this endpoint simply acknowledges callbacks.
export default async () =>
  new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });

export const config = { path: "/api/callback" };
