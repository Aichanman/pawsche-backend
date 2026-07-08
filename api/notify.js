bash

cat /home/claude/pawsche-backend/api/notify.js
出力

import webpush from 'web-push';
import { subscriptions } from './subscribe.js';

webpush.setVapidDetails(
  'mailto:pawsche@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://aichanman.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { title, body, tag } = req.body;
  const payload = JSON.stringify({ title, body, tag, url: '/pawsche/' });

  const results = await Promise.allSettled(
    subscriptions.map(sub => webpush.sendNotification(sub, payload))
  );

  const failed = results.filter(r => r.status === 'rejected').length;
  return res.status(200).json({ sent: results.length - failed, failed });
}
