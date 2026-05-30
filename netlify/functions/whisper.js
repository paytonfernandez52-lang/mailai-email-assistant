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
    const { audio, mimeType } = JSON.parse(event.body);

    const audioBuffer = Buffer.from(audio, 'base64');
    const audioBlob = new Blob([audioBuffer], { type: mimeType || 'audio/mp4' });

    const ext = mimeType && mimeType.includes('mp4') ? 'mp4' : 'webm';
    const formData = new FormData();
    formData.append('file', audioBlob, `recording.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: formData
    });

    const data = await res.json();
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: data.text || '' })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message })
    };
  }
};
