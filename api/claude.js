const FREE_LIMIT = 10;
const usageStore = {};

function getMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
}

function getUserKey(ip) {
  return `${ip}-${getMonthKey()}`;
}

function getUsage(ip) {
  return usageStore[getUserKey(ip)] || 0;
}

function incrementUsage(ip) {
  const key = getUserKey(ip);
  usageStore[key] = (usageStore[key] || 0) + 1;
  return usageStore[key];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://aichanman.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
    const usage = getUsage(ip);
    return res.status(200).json({ usage, limit: FREE_LIMIT, remaining: Math.max(0, FREE_LIMIT - usage) });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, max_tokens = 1000, userApiKey } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';

    let apiKey;

    if (userApiKey && userApiKey.startsWith('sk-ant-')) {
      apiKey = userApiKey;
    } else {
      const usage = getUsage(ip);
      if (usage >= FREE_LIMIT) {
        return res.status(429).json({
          error: 'FREE_LIMIT_EXCEEDED',
          message: `今月の無料枠（${FREE_LIMIT}回）を使い切りました。⚙️設定のAI設定からAPIキーを登録すると引き続き使えます。`,
          usage,
          limit: FREE_LIMIT
        });
      }
      apiKey = process.env.ANTHROPIC_API_KEY;
      incrementUsage(ip);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens, messages }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
