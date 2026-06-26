# 🌿 AI Plant Health Analysis Integration Guide

This document describes the AI plant health analysis system that has been integrated into your JC371 JimiIOT Dashboard.

## Overview

The system now includes an AI-powered plant health analyzer that:

- **Captures video frames** from your dash camera feeds (HLS streams)
- **Analyzes plant health** using Google's Gemini Vision AI (gemini-2.5-flash)
- **Provides detailed diagnostics** including:
  - Plant identification (common & scientific names)
  - Soil condition assessment
  - Health rating (0-100%)
  - Health status classification (Good/Dry/Sunburned/Overwatered/Diseased)
  - Detailed visual analysis
  - Actionable care recommendations

## What Was Added

### Backend Changes

1. **New Dependencies** (`package.json`):
   - `@google/generative-ai` - Google's Generative AI SDK
   - `cors` - Cross-origin resource sharing
   - `dotenv` - Environment variable management

2. **New Service** (`services/geminiPlantAnalyzer.js`):
   - Handles Gemini Vision API communication
   - Validates and normalizes AI responses
   - Ensures consistent JSON output schema

3. **New API Route** (`routes/analyzePlant.js`):
   - `POST /api/analyze-plant` endpoint
   - Accepts base64-encoded JPEG images
   - Returns structured plant health analysis

4. **Server Updates** (`server.js`):
   - Integrates Gemini service and API routes
   - Loads environment variables via dotenv

### Frontend Changes

1. **Enhanced UI** (`dashboard-web/index.html`):
   - New "AI Plant Health Analysis" panel
   - Frame capture button
   - Real-time health visualization (progress bar)
   - Plant information display
   - Care recommendations list
   - Analysis metadata (timestamp)

2. **Enhanced Client Logic** (`dashboard-web/dashboard-client.js`):
   - `captureVideoFrameAsBase64Jpeg()` - Captures frames from video streams
   - `displayAnalysisResult()` - Renders analysis results with visual indicators
   - `analyzeCurrentFrame()` - Orchestrates the analysis workflow
   - Automatic button enable/disable based on video stream status

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

This installs the new Gemini AI library and supporting packages.

### 2. Get Your Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikeys)
2. Click "Create API Key" or use an existing one
3. Copy the API key

**Security Note**: The API key should NEVER be exposed in frontend code. It's kept securely on the backend only.

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=3000
```

**Important**: 
- Add `.env` to your `.gitignore` to prevent accidental commits
- Use `.env.example` as a template (no secrets in the repo)

### 4. Start the Server

```bash
npm start
```

The server will:
- Load your Gemini API key from the `.env` file
- Start the Express server on port 3000 (or your configured PORT)
- Mount all routes including `/api/analyze-plant`
- Serve the dashboard web UI

### 5. Open the Dashboard

Navigate to: `http://localhost:3000`

You should see:
- The existing GPS tracker and video streams
- A new "🌿 AI Plant Health Analysis" panel at the bottom

## Using the AI Analysis

### Step 1: Start Video Streams

1. Ensure your JC371 device is connected and sending data
2. Click **▶ Start Video** button in the video panel
3. Wait for video streams to appear on both Channel 1 and Channel 2

### Step 2: Capture and Analyze

1. Wait for the video to stabilize (you should see frames flowing)
2. Frame your dash camera view to include a plant/vegetation
3. Click **📷 Analyze from Camera** button
4. The system will:
   - Capture the current video frame
   - Send it to Gemini AI for analysis
   - Display results in real-time

### Step 3: Review Results

The analysis displays:

- **Plant Name** (Common & Scientific)
- **Soil Condition** (Dry/Damp/Wet/Good)
- **Health Rating** (0-100% with color indicator)
  - Green (70-100%): Plant is healthy
  - Blue (50-69%): Fair condition
  - Orange (30-49%): Poor condition
  - Red (0-29%): Critical condition
- **Health Status** (Good/Dry/Sunburned/Overwatered/Diseased/Unknown)
- **Detailed Analysis** (Visual findings with 2-3 sentence explanation)
- **Care Recommendations** (3 actionable tips)

## Architecture

```
┌─ Browser Dashboard ──────────────────────────┐
│                                              │
│  Video Stream (HLS/JPEG)                     │
│    ↓                                         │
│  Canvas Frame Capture                        │
│    ↓                                         │
│  Base64 JPEG Encoding                        │
│    ↓                                         │
│  POST /api/analyze-plant                     │
│                                              │
└──────────────────────────────────────────────┘
                     ↓
┌─ Node.js Backend ────────────────────────────┐
│                                              │
│  Express Route Handler                       │
│    ↓                                         │
│  Validate Base64 Image                       │
│    ↓                                         │
│  Gemini Vision API Call                      │
│    ├─ Model: gemini-2.5-flash                │
│    ├─ Input: Base64 JPEG + Prompt            │
│    └─ Output: JSON Analysis                  │
│    ↓                                         │
│  Normalize & Validate Response                │
│    ↓                                         │
│  Return Structured JSON                      │
│                                              │
└──────────────────────────────────────────────┘
                     ↓
┌─ Browser (continued) ────────────────────────┐
│                                              │
│  Render Results in UI                        │
│  ├─ Health Bar (visual rating)               │
│  ├─ Status Badge (color-coded)               │
│  ├─ Plant Info Cards                         │
│  └─ Care Advice List                         │
│                                              │
└──────────────────────────────────────────────┘
```

## API Documentation

### Endpoint: POST /api/analyze-plant

**Request:**
```json
{
  "base64Image": "..." // Base64-encoded JPEG image
}
```

**Response (Success):**
```json
{
  "ok": true,
  "analysis": {
    "plantName": "Tomato",
    "scientificName": "Solanum lycopersicum",
    "soilCondition": "Damp",
    "plantHealthRating": 85,
    "healthStatus": "Good",
    "detailedAnalysis": "The plant shows vibrant green foliage with healthy leaf structure...",
    "careAdvice": [
      "Ensure consistent watering 2-3 times weekly",
      "Provide 6-8 hours of direct sunlight daily",
      "Consider pruning excess foliage for better air circulation"
    ]
  },
  "timestamp": "2024-06-26T10:30:45.123Z"
}
```

**Response (Error):**
```json
{
  "ok": false,
  "message": "Failed to analyze plant image.",
  "rawResponse": "..." // Optional: first 500 chars of raw API response
}
```

**Status Codes:**
- `200`: Analysis successful
- `400`: Invalid request (missing or malformed base64Image)
- `500`: Server error (API key missing, Gemini API error, parse error)

## Performance Considerations

### Frame Capture

- Captures from the currently selected video channel
- Requires video to be in `readyState >= 2` (HAVE_CURRENT_DATA)
- Canvas size adapts to video element dimensions
- JPEG quality set to 0.92 for balance between file size (~100-200 KB) and quality

### API Requests

- Each analysis makes a call to Google's Gemini Vision API
- Network latency + AI processing typically: 3-8 seconds
- Button is disabled during analysis to prevent concurrent requests
- Base64 payload size: ~150-250 KB (sent as JSON)

### Rate Limiting

- Gemini API has quota limits; check your Google AI account for limits
- Recommend 5-10 second minimum between analyses
- Production deployments should implement rate limiting middleware

## Troubleshooting

### Issue: API key error on startup

**Solution:**
1. Create `.env` file in project root
2. Set `GEMINI_API_KEY=your_key_here`
3. Restart the server

### Issue: Button stays disabled

**Cause:** Video stream not initialized or not ready

**Solution:**
1. Click "▶ Start Video" button
2. Wait 3-5 seconds for video to load
3. Ensure device is connected and sending video
4. Check browser console for errors

### Issue: "Failed to capture frame" error

**Cause:** Video element not loaded or has zero dimensions

**Solution:**
1. Verify video is playing (you see the video feed)
2. Check that video element hasn't been hidden or resized to 0
3. Try clicking "Analyze from Camera" again after video stabilizes

### Issue: "Analysis failed" with parse error

**Cause:** Gemini API response couldn't be parsed as JSON

**Solution:**
1. Check browser console for raw response
2. Verify your Gemini API key is valid
3. Ensure your account has API access enabled
4. Try again with a clearer image of a plant

### Issue: CORS error (if accessing from different domain)

**Solution:**
- Server already has CORS middleware; if you're running into this, ensure you're accessing from `http://localhost:3000` or configure CORS in `server.js`

## Integration with Existing Features

The AI analysis panel:

✅ **Preserves all existing functionality:**
- GPS tracking continues to work
- Video streams continue to work
- Audio playback continues to work
- HLS streaming continues to work

✅ **Integrates seamlessly:**
- Uses the same video streams as the dashboard
- Respects the same device/channel selection
- Maintains responsive design
- Follows existing UI patterns and colors

## Advanced Usage

### Using Different Video Channels

Currently, the analyzer captures from Channel 1 by default. To capture from Channel 2:
- The `selectedAnalysisChannel` variable in `dashboard-client.js` controls this
- Future enhancement: Add UI buttons to toggle between channels

### Periodic Analysis

To analyze frames automatically every N seconds:

```javascript
let autoAnalyzeInterval = null;

function startAutoAnalyze(intervalMs = 5000) {
  autoAnalyzeInterval = setInterval(analyzeCurrentFrame, intervalMs);
}

function stopAutoAnalyze() {
  clearInterval(autoAnalyzeInterval);
}
```

### History/Logging

To persist analysis results to a database or file:

```javascript
// Add to displayAnalysisResult() or after successful API call:
const analysisRecord = {
  timestamp: new Date().toISOString(),
  channel: selectedAnalysisChannel,
  analysis: data.analysis
};

// Send to a persistence endpoint
fetch('/api/save-analysis', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(analysisRecord)
});
```

## Security Notes

1. **API Key Protection**:
   - NEVER expose `GEMINI_API_KEY` in frontend code
   - Keep `.env` file local; add to `.gitignore`
   - Rotate keys periodically in production

2. **Rate Limiting** (Production):
   - Add middleware to limit requests per IP
   - Implement request queuing for high-traffic scenarios
   - Monitor API usage and costs

3. **Input Validation**:
   - Base64 image format is validated on the backend
   - Maximum payload size should be configurable (currently 15MB via `express.json({ limit: '15mb' })`)

4. **Error Handling**:
   - Sensitive error details (API keys, raw responses) are never sent to the frontend
   - Only user-friendly error messages are displayed in the UI

## Testing

### Manual Testing Checklist

- [ ] Server starts without errors: `npm start`
- [ ] Dashboard loads at `http://localhost:3000`
- [ ] GPS data appears and map initializes
- [ ] "Start Video" button works and streams display
- [ ] Analyze button is disabled when no video is playing
- [ ] Analyze button becomes enabled when video is playing
- [ ] Clicking analyze captures a frame and sends to API
- [ ] AI results display in the panel with correct formatting
- [ ] Health rating bar updates correctly (0-100%)
- [ ] Care advice displays as a bulleted list
- [ ] Timestamp updates on each analysis

### Example Test Images

For testing without a live camera, you can:
1. Take a screenshot of a plant
2. Convert to base64
3. Use browser DevTools to manually call the API:

```javascript
const base64 = "..."; // your base64 image
fetch('/api/analyze-plant', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ base64Image: base64 })
}).then(r => r.json()).then(d => console.log(d));
```

## Future Enhancements

Potential improvements to consider:

1. **Multi-plant Detection**: Analyze multiple plants in a single frame
2. **Trend Analysis**: Track plant health over time with historical comparisons
3. **Alerting**: Notify when health rating drops below a threshold
4. **Image History**: Store and compare previous analyses
5. **Custom Prompts**: Allow users to ask specific questions about the plant
6. **Channel Selection UI**: Add buttons to toggle between video channels for analysis
7. **Export Reports**: Generate PDF reports of plant analyses
8. **Batch Analysis**: Analyze multiple frames and generate a summary
9. **Integration with External Services**: Send alerts to SMS/Email/Slack
10. **Local Model Alternative**: Support offline plant analysis for privacy-critical deployments

## References

- [Google Generative AI Documentation](https://ai.google.dev/docs)
- [Gemini API Models](https://ai.google.dev/models)
- [Canvas API for Frame Capture](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Base64 Encoding](https://developer.mozilla.org/en-US/docs/Glossary/Base64)

## Support

For issues or questions:

1. Check the **Troubleshooting** section above
2. Review browser console for errors (F12)
3. Check server console for backend errors
4. Verify `.env` file has valid `GEMINI_API_KEY`
5. Test with `curl` or Postman to isolate issues

---

**Last Updated**: June 26, 2024  
**Integration Status**: ✅ Complete
