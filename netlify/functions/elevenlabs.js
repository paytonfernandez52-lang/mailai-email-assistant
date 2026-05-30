const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
  }

  const token = (event.headers['authorization'] || '').replace('Bearer ', '');
  if (!token || token !== process.env.PAIA_TOKEN) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const { text } = JSON.parse(event.body);

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.MARIA_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVEN_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });

    const buffer = await res.arrayBuffer();
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'audio/mpeg' },
      isBase64Encoded: true,
      body: Buffer.from(buffer).toString('base64')
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
