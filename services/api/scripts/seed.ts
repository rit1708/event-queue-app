import { getDb } from '../src/mongo';

async function main() {
  const db = await getDb();

  const domains = [
    { name: 'demo.com' },
    { name: 'shop.example' },
  ];

  for (const d of domains) {
    const existing = await db.collection('domains').findOne({ name: d.name });
    if (!existing) {
      await db.collection('domains').insertOne({ name: d.name, createdAt: new Date() });
    }
  }

  const events = [
    { domain: 'demo.com', name: 'Launch Day', queueLimit: 2, intervalSec: 30 },
    { domain: 'demo.com', name: 'Flash Sale', queueLimit: 3, intervalSec: 30 },
    { domain: 'shop.example', name: 'Holiday Sale', queueLimit: 2, intervalSec: 30 },
    { domain: 'shop.example', name: 'VIP Access', queueLimit: 1, intervalSec: 45 },
  ];

  for (const e of events) {
    const existing = await db.collection('events').findOne({ domain: e.domain, name: e.name });
    if (!existing) {
      await db.collection('events').insertOne({ ...e, createdAt: new Date() });
    }
  }

  console.log('Seed completed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
