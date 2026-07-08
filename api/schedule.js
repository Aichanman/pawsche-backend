bash

cat /home/claude/pawsche-backend/api/schedule.js
出力

import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:pawsche@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

// 通知予約ストア（メモリ）
const scheduledMap = new Map();

async function sendPush(subscription, title, body, tag) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify({
      title, body, tag, url: '/pawsche/'
    }));
  } catch(e) {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://aichanman.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { todos = [], events = [], subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'No subscription' });

  const now = new Date();
  const subKey = subscription.endpoint;

  // 既存のタイマーをクリア
  if (scheduledMap.has(subKey)) {
    scheduledMap.get(subKey).forEach(t => clearTimeout(t));
  }
  const timers = [];

  // TODO通知
  todos.filter(t => !t.done && t.deadline).forEach(t => {
    const diff = daysUntil(t.deadline);
    [3, 1, 0].forEach(d => {
      if (diff !== d) return;
      const notifTime = new Date(t.deadline + 'T07:00:00');
      const delay = notifTime - now;
      if (delay > 0 && delay < 86400000 * 4) {
        const label = d === 0 ? '今日が締切！' : d === 1 ? '明日が締切' : '締切まで3日';
        timers.push(setTimeout(() => sendPush(subscription, `📌 ${t.text}`, label, `todo-${t.id}-${d}`), delay));
      }
    });

    // 締切時間設定済み → 2時間前・1時間前
    if (t.deadlineTime && diff === 0) {
      const [hh, mm] = t.deadlineTime.split(':').map(Number);
      [2, 1].forEach(hoursB => {
        const notifTime = new Date();
        notifTime.setHours(hh - hoursB, mm, 0, 0);
        const delay = notifTime - now;
        if (delay > 0) {
          timers.push(setTimeout(() => sendPush(subscription, `⏰ ${t.text}`, `締切${hoursB}時間前 (${t.deadlineTime})`, `todo-time-${t.id}-${hoursB}h`), delay));
        }
      });
    }
  });

  // カレンダー予定通知
  events.forEach(ev => {
    const evDateStr = localDateStr(new Date(ev.date));
    const diff = daysUntil(evDateStr);
    [3, 1, 0].forEach(d => {
      if (diff !== d) return;
      const notifTime = new Date(evDateStr + 'T07:00:00');
      const delay = notifTime - now;
      if (delay > 0 && delay < 86400000 * 4) {
        const evDate = new Date(ev.date);
        const timeStr = `${String(evDate.getHours()).padStart(2,'0')}:${String(evDate.getMinutes()).padStart(2,'0')}`;
        const label = d === 0 ? `今日 ${timeStr}〜` : d === 1 ? `明日 ${timeStr}〜` : `3日後 ${timeStr}〜`;
        timers.push(setTimeout(() => sendPush(subscription, `📅 ${ev.title}`, label, `event-${ev.id}-${d}`), delay));
      }
    });
  });

  scheduledMap.set(subKey, timers);
  return res.status(200).json({ scheduled: timers.length });
}
