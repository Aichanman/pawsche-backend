bash

cat /home/claude/pawsche-backend/api/friends.js
出力

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://aichanman.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {
    // ユーザー登録・取得
    if (action === 'register' && req.method === 'POST') {
      const { userId, displayName } = req.body;
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const existing = await redis.get(`user:${userId}`);
      if (!existing) {
        await redis.set(`user:${userId}`, { userId, displayName: displayName || userId, friends: [], createdAt: new Date().toISOString() });
      }
      return res.status(200).json({ ok: true, user: existing || { userId, displayName } });
    }

    // 友達追加
    if (action === 'addFriend' && req.method === 'POST') {
      const { userId, friendId } = req.body;
      const user = await redis.get(`user:${userId}`);
      const friend = await redis.get(`user:${friendId}`);
      if (!user) return res.status(404).json({ error: 'まず自分のIDを登録してください' });
      if (!friend) return res.status(404).json({ error: 'そのIDのユーザーが見つかりません' });
      if (userId === friendId) return res.status(400).json({ error: '自分自身は追加できません' });
      if (!user.friends.includes(friendId)) {
        user.friends.push(friendId);
        await redis.set(`user:${userId}`, user);
      }
      if (!friend.friends.includes(userId)) {
        friend.friends.push(userId);
        await redis.set(`user:${friendId}`, friend);
      }
      return res.status(200).json({ ok: true, friend: { userId: friend.userId, displayName: friend.displayName } });
    }

    // 活動データをアップロード
    if (action === 'updateActivity' && req.method === 'POST') {
      const { userId, activity } = req.body;
      await redis.set(`activity:${userId}`, { ...activity, updatedAt: new Date().toISOString() });
      return res.status(200).json({ ok: true });
    }

    // 一言メッセージ＋スタンプを送る
    if (action === 'sendMessage' && req.method === 'POST') {
      const { fromUserId, toUserId, stamp, message } = req.body;
      const fromUser = await redis.get(`user:${fromUserId}`);
      await redis.set(`message:${toUserId}`, {
        from: fromUserId,
        fromName: fromUser?.displayName || fromUserId,
        stamp: stamp || '👏',
        message: (message || '').slice(0, 30),
        sentAt: new Date().toISOString()
      });
      return res.status(200).json({ ok: true });
    }

    // 友達一覧と活動データを取得
    if (action === 'getFriends' && req.method === 'GET') {
      const { userId } = req.query;
      const user = await redis.get(`user:${userId}`);
      if (!user) return res.status(200).json({ friends: [], myMessage: null });
      const friendsData = await Promise.all(
        (user.friends || []).map(async (fid) => {
          const friend = await redis.get(`user:${fid}`);
          const activity = await redis.get(`activity:${fid}`);
          return { userId: fid, displayName: friend?.displayName || fid, activity };
        })
      );
      const myMessage = await redis.get(`message:${userId}`);
      return res.status(200).json({ friends: friendsData, myMessage });
    }

    // 自分の情報取得
    if (action === 'getUser' && req.method === 'GET') {
      const { userId } = req.query;
      const user = await redis.get(`user:${userId}`);
      return res.status(200).json({ user });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
完了
