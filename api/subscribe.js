bash

cat /home/claude/pawsche-backend/api/subscribe.js
出力

export const subscriptions = [];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://aichanman.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'No subscription' });
    const exists = subscriptions.find(s => s.endpoint === subscription.endpoint);
    if (!exists) subscriptions.push(subscription);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body;
    const idx = subscriptions.findIndex(s => s.endpoint === endpoint);
    if (idx > -1) subscriptions.splice(idx, 1);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
