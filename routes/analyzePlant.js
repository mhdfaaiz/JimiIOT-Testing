import express from 'express';
import { analyzePlantImage } from '../services/geminiPlantAnalyzer.js';

const router = express.Router();
const liveAnalysisCache = new Map();

function getLiveCacheTtlMs() {
  const ttlMs = Number(process.env.AI_CACHE_TTL_MS || 45000);
  return Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 45000;
}

function getCachedAnalysis(cacheKey) {
  const entry = liveAnalysisCache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    liveAnalysisCache.delete(cacheKey);
    return null;
  }
  return entry.analysis;
}

function setCachedAnalysis(cacheKey, analysis) {
  liveAnalysisCache.set(cacheKey, {
    analysis,
    expiresAt: Date.now() + getLiveCacheTtlMs()
  });
}

/**
 * POST /api/analyze-plant
 * Accepts a base64 encoded JPEG image and returns plant health analysis
 */
router.post('/analyze-plant', async (req, res) => {
  try {
    const { base64Image, frameSignature, isLive } = req.body || {};

    if (!base64Image || typeof base64Image !== 'string') {
      return res.status(400).json({ 
        message: 'base64Image is required and must be a string.' 
      });
    }

    // Validate base64 format
    if (!base64Image.match(/^[A-Za-z0-9+/=]+$/)) {
      return res.status(400).json({ 
        message: 'Invalid base64 format.' 
      });
    }

    const cacheKey = isLive && typeof frameSignature === 'string' && frameSignature
      ? `live:${frameSignature}`
      : null;

    if (cacheKey) {
      const cachedAnalysis = getCachedAnalysis(cacheKey);
      if (cachedAnalysis) {
        return res.status(200).json({
          ok: true,
          analysis: cachedAnalysis,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    const analysis = await analyzePlantImage(base64Image, process.env.GEMINI_API_KEY);

    if (cacheKey) {
      setCachedAnalysis(cacheKey, analysis);
    }

    return res.status(200).json({
      ok: true,
      analysis,
      cached: false,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[/api/analyze-plant] Error:', err.message, err.rawResponse);
    
    return res.status(err.statusCode || 500).json({
      ok: false,
      message: err.message || 'Failed to analyze plant image.',
      retryAfterMs: err.retryAfterMs || 0,
      rawResponse: err.rawResponse ? err.rawResponse.substring(0, 500) : undefined
    });
  }
});

export default router;
