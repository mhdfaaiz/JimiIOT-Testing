import { GoogleGenerativeAI } from '@google/generative-ai';

const ANALYSIS_PROMPT = `Analyze this image and determine if it contains a plant. If it's a plant or contains plants/vegetation, analyze the health status and soil condition.

Please return a JSON object with the following fields:
{
  "plantName": "Common name of the plant (or 'Unknown/Not a plant' if not applicable)",
  "scientificName": "Scientific name of the plant (or 'N/A')",
  "soilCondition": "Dry / Damp / Wet / Good condition (choose the most accurate one)",
  "plantHealthRating": 0-100 (a percentage score of the overall plant health),
  "healthStatus": "Good / Dry / Sunburned / Overwatered / Diseased / Unknown",
  "detailedAnalysis": "A concise paragraph (2-3 sentences) explaining the visual findings, including leaf condition, soil appearance, and any signs of pests, discoloration, or watering issues.",
  "careAdvice": [
    "Actionable care tip 1",
    "Actionable care tip 2",
    "Actionable care tip 3"
  ]
}

IMPORTANT: Return ONLY the raw JSON string inside your response. Do not enclose it in markdown formatting like \`\`\`json.`;

function createProviderError(message, statusCode = 500, rawResponse = '', retryAfterMs = 0) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.rawResponse = rawResponse;
  error.retryAfterMs = retryAfterMs;
  return error;
}

function getRetryAfterMs(headers) {
  const retryAfter = headers?.get?.('retry-after');
  if (!retryAfter) return 0;

  const asNumber = Number(retryAfter);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return Math.ceil(asNumber * 1000);
  }

  const asDate = Date.parse(retryAfter);
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.now());
  }

  return 0;
}

function getAiConfig() {
  const provider = String(
    process.env.AI_PROVIDER
      || (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'gemini')
  ).toLowerCase();

  if (provider === 'gemini') {
    return {
      provider,
      apiKey: process.env.AI_API_KEY || process.env.GEMINI_API_KEY,
      model: process.env.AI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    };
  }

  if (provider === 'openrouter') {
    return {
      provider,
      apiKey: process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY,
      model: process.env.AI_MODEL || 'openai/gpt-4o-mini',
      baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1'
    };
  }

  if (provider === 'openai') {
    return {
      provider,
      apiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY,
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1'
    };
  }

  throw createProviderError(
    `Unsupported AI_PROVIDER "${provider}". Use gemini, openrouter, or openai.`,
    500
  );
}

async function analyzeWithGemini(base64Image, config) {
  const genAI = new GoogleGenerativeAI(config.apiKey);
  const model = genAI.getGenerativeModel({ model: config.model });

  const imagePart = {
    inlineData: {
      data: base64Image,
      mimeType: 'image/jpeg'
    }
  };

  try {
    const result = await model.generateContent([ANALYSIS_PROMPT, imagePart]);
    return result.response.text();
  } catch (error) {
    const message = String(error?.message || 'Gemini request failed.');
    const isQuota = /429|quota|rate limit|resource_exhausted|too many requests/i.test(message);
    throw createProviderError(message, isQuota ? 429 : 500, message, isQuota ? 60000 : 0);
  }
}

function extractOpenAiStyleText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }
  return '';
}

async function analyzeWithOpenAiCompatible(base64Image, config) {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...(config.provider === 'openrouter' ? {
        'HTTP-Referer': process.env.AI_REFERER || 'http://localhost:3000',
        'X-Title': process.env.AI_APP_NAME || 'JimiIOT Plant Analysis'
      } : {})
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYSIS_PROMPT },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64Image}` }
            }
          ]
        }
      ]
    })
  });

  const responseText = await response.text();
  let payload = null;

  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error?.message || `AI provider request failed (HTTP ${response.status}).`;
    throw createProviderError(message, response.status, responseText, getRetryAfterMs(response.headers));
  }

  const content = extractOpenAiStyleText(payload);
  if (!content) {
    throw createProviderError('AI provider returned an empty response.', 500, responseText);
  }

  return content;
}

/**
 * Sanitize and parse JSON response from Gemini
 * Handles cases where model wraps JSON in markdown code blocks
 */
function sanitizeAndParseGeminiJson(rawText) {
  const cleanText = String(rawText || '').replace(/```json|```/g, '').trim();
  return JSON.parse(cleanText);
}

/**
 * Normalize and validate the AI analysis result
 * Ensures all fields meet the required schema
 */
function normalizeResult(obj) {
  return {
    plantName: typeof obj.plantName === 'string' ? obj.plantName : 'Unknown/Not a plant',
    scientificName: typeof obj.scientificName === 'string' ? obj.scientificName : 'N/A',
    soilCondition: typeof obj.soilCondition === 'string' ? obj.soilCondition : 'Unknown',
    plantHealthRating: Number.isFinite(Number(obj.plantHealthRating))
      ? Math.max(0, Math.min(100, Number(obj.plantHealthRating)))
      : 0,
    healthStatus: typeof obj.healthStatus === 'string' ? obj.healthStatus : 'Unknown',
    detailedAnalysis: typeof obj.detailedAnalysis === 'string' ? obj.detailedAnalysis : '',
    careAdvice: Array.isArray(obj.careAdvice)
      ? obj.careAdvice.map((x) => String(x)).filter(Boolean).slice(0, 5)
      : []
  };
}

/**
 * Analyze plant image using Gemini Vision API
 * @param {string} base64Image - Base64 encoded JPEG image
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} Normalized analysis result
 */
export async function analyzePlantImage(base64Image, apiKey) {
  const config = getAiConfig();
  if (!config.apiKey && !apiKey) {
    throw createProviderError(
      'AI API key missing on server. Set GEMINI_API_KEY, OPENROUTER_API_KEY, OPENAI_API_KEY, or AI_API_KEY in .env.',
      500
    );
  }

  if (!config.apiKey && apiKey) {
    config.apiKey = apiKey;
  }

  const responseText = config.provider === 'gemini'
    ? await analyzeWithGemini(base64Image, config)
    : await analyzeWithOpenAiCompatible(base64Image, config);

  let parsed;
  try {
    parsed = sanitizeAndParseGeminiJson(responseText);
  } catch (err) {
    throw createProviderError('Failed to parse model response as JSON.', 500, responseText);
  }

  return normalizeResult(parsed);
}
