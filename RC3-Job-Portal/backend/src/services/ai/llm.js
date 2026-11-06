const { GoogleGenerativeAI } = require('@google/generative-ai');
const AppError = require('../../utils/AppError');
const { geminiApiKey, geminiModel } = require('../../config/env');

const TIMEOUT_MS = 60000;
const MODEL_ALIASES = { 'gemini-latest': 'gemini-flash-latest' };
const FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemini-3.8-flash'];

function modelCandidates(configuredModel = geminiModel) {
  const configured = MODEL_ALIASES[configuredModel] || configuredModel || 'gemini-flash-latest';
  return [...new Set([configured, ...FALLBACK_MODELS])];
}

let genAI;

function getClient() {
  if (!geminiApiKey) {
    throw new AppError('GEMINI_API_KEY is not configured', 503);
  }

  if (!genAI) genAI = new GoogleGenerativeAI(geminiApiKey);

  return genAI;
}

async function callGemini({ system, prompt }) {
  const client = getClient();
  const failures = [];

  for (const modelName of modelCandidates()) {
    try {
      const model = client.getGenerativeModel(
        {
          model: modelName,
          systemInstruction: system,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 16384,
          },
        },
        { timeout: TIMEOUT_MS }
      );

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (text.trim()) return text;
      failures.push({ status: 502, message: `Gemini returned an empty response from ${modelName}.` });
    } catch (err) {
      const status = Number(err.status || err.response?.status) || 0;
      failures.push({ status, message: err.message || 'Unknown Gemini error' });
      console.error(`Gemini error (${modelName}, ${status || 'network'}):`, err.message);

      if (status && ![400, 404, 429, 500, 502, 503, 504].includes(status)) break;
    }
  }

  if (failures.some((failure) => failure.status === 429)) {
    throw new AppError(
      'Gemini quota is exhausted for this API key. Check your Google AI Studio limits or billing, then retry.',
      429
    );
  }
  if (failures.length && failures.every((failure) => [0, 500, 502, 503, 504].includes(failure.status))) {
    throw new AppError('Gemini is temporarily unavailable or at capacity. Please retry shortly.', 503);
  }
  if (failures.some((failure) => failure.status === 401 || failure.status === 403)) {
    throw new AppError('Gemini rejected the API key or the key lacks permission for content generation.', 503);
  }
  throw new AppError('Gemini could not use the configured model. Check GEMINI_MODEL and try again.', 502);
}

function parseJSON(text) {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  return JSON.parse(cleaned);
}

/**
 * Calls Gemini and returns validated JSON.
 * Never trusts raw output: parse, validate with the Zod schema, retry once.
 */
async function generateJSON({ system, prompt, schema }) {
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let text = '';

    try {
      text = await callGemini({ system, prompt });

      return schema.parse(parseJSON(text));
    } catch (err) {
      if (err instanceof AppError) throw err;

      console.error(`Gemini attempt ${attempt} failed:`, err.message);
      console.error('Raw output was:', text.slice(0, 500));

      lastError = err;
    }
  }

  console.error('Gemini returned invalid output:', lastError?.message);

  throw new AppError(
    'Gemini returned an unexpected response, please try again',
    502
  );
}

module.exports = { generateJSON, modelCandidates };