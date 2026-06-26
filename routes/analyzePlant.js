import express from 'express';
import { analyzePlantImage } from '../services/geminiPlantAnalyzer.js';

const router = express.Router();

/**
 * POST /api/analyze-plant
 * Accepts a base64 encoded JPEG image and returns plant health analysis
 */
router.post('/analyze-plant', async (req, res) => {
  try {
    const { base64Image } = req.body || {};

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

    const analysis = await analyzePlantImage(base64Image, process.env.GEMINI_API_KEY);

    return res.status(200).json({
      ok: true,
      analysis,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[/api/analyze-plant] Error:', err.message, err.rawResponse);
    
    return res.status(500).json({
      ok: false,
      message: err.message || 'Failed to analyze plant image.',
      rawResponse: err.rawResponse ? err.rawResponse.substring(0, 500) : undefined
    });
  }
});

export default router;
