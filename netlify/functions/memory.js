const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const token = (event.headers['authorization'] || '').replace('Bearer ', '');
  if (!token || token !== process.env.PAIA_TOKEN) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { mode, messages } = JSON.parse(event.body || '{}');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };

    if (mode === 'load') {
      const res = await fetch(`${supabaseUrl}/rest/v1/maia_memories?select=content&order=created_at.asc`, { headers });
      const data = await res.json();
      const memories = Array.isArray(data) ? data.map(m => m.content) : [];
      return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ memories }) };
    }

    if (mode === 'extract') {
      const prompt = `You are a memory extraction assistant. Given this conversation exchange, extract ANYTHING worth remembering for future conversations — personal facts, preferences, opinions, projects, decisions, questions asked, topics discussed, things learned, or anything else that could be useful context later. Be liberal about what you save. Return a JSON array of concise strings (e.g. ["Has a dog named Rex, German Shepherd", "Prefers dark roast coffee", "Working on an email assistant app", "Asked about exchange rates today"]), or [] if truly nothing worth saving. Raw JSON only, no markdown.`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          system: prompt,
          messages: [{ role: 'user', content: JSON.stringify(messages) }]
        })
      });
      const aiData = await res.json();
      let facts = [];
      try {
        const text = aiData.content[0].text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        facts = JSON.parse(text);
      } catch { facts = []; }

      if (facts.length > 0) {
        await fetch(`${supabaseUrl}/rest/v1/maia_memories`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body: JSON.stringify(facts.map(f => ({ content: f })))
        });
      }

      return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ saved: facts.length }) };
    }

    if (mode === 'clear') {
      await fetch(`${supabaseUrl}/rest/v1/maia_memories?id=neq.00000000-0000-0000-0000-000000000000`, {
        method: 'DELETE',
        headers
      });
      return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid mode' }) };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
