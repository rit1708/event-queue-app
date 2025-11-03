export type InitOptions = { baseUrl: string };
let BASE = '';

export function init(opts: InitOptions) {
  BASE = opts.baseUrl.replace(/\/$/, '');
}

export async function joinQueue(eventId: string, userId: string) {
  const r = await fetch(`${BASE}/queue/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, userId }),
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as { state: string; position: number; remaining: number };
}

export async function getStatus(eventId: string, userId: string) {
  const u = new URL(`${BASE}/queue/status`);
  u.searchParams.set('eventId', eventId);
  u.searchParams.set('userId', userId);
  const r = await fetch(u);
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as { state: string; position: number; remaining: number };
}

export function pollStatus(eventId: string, userId: string, cb: (s: { state: string; position: number; remaining: number }) => void, intervalMs = 1000) {
  let timer: any;
  const tick = async () => {
    try {
      const s = await getStatus(eventId, userId);
      cb(s);
    } catch {}
  };
  timer = setInterval(tick, intervalMs);
  tick();
  return () => clearInterval(timer);
}
