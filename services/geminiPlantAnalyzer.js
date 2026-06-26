import { GoogleGenerativeAI } from '@google/generative-ai';

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
  if (!apiKey) {
    throw new Error('Gemini API key missing on server. Set GEMINI_API_KEY in .env file.');
  }

  const prompt = `Analyze this image and determine if it contains a plant. If it's a plant or contains plants/vegetation, analyze the health status and soil condition.

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

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const imagePart = {
    inlineData: {
      data: base64Image,
      mimeType: 'image/jpeg'
    }
  };

  const result = await model.generateContent([prompt, imagePart]);
  const responseText = result.response.text();

  let parsed;
  try {
    parsed = sanitizeAndParseGeminiJson(responseText);
  } catch (err) {
    const e = new Error('Failed to parse model response as JSON.');
    e.rawResponse = responseText;
    throw e;
  }

  return normalizeResult(parsed);
}
