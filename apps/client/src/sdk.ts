export type Status = { state: string; position: number; remaining: number };
let BASE = '';

export function init(opts: { baseUrl: string }) {
  BASE = opts.baseUrl.replace(/\/$/, '');
}

export async function joinQueue(eventId: string, userId: string): Promise<Status> {
  const r = await fetch(`${BASE}/queue/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, userId }),
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as Status;
}

export async function getStatus(eventId: string, userId: string): Promise<Status> {
  const u = new URL(`${BASE}/queue/status`);
  u.searchParams.set('eventId', eventId);
  u.searchParams.set('userId', userId);
  const r = await fetch(u);
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as Status;
}

export function pollStatus(eventId: string, userId: string, cb: (s: Status) => void, intervalMs = 1000) {
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
