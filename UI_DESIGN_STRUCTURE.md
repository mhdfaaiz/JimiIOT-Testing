# JimiIOT Dashboard UI - Complete Design Structure

## 📐 Overall Layout Architecture

### Page Structure
```
┌─────────────────────────────────────────────────────────────┐
│                         HEADER (Fixed)                       │
│  🛰️ JC371 / JimiIoT — GPS Tracking & Live Monitor           │
│  [Connection Indicator] Connecting...                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      MAIN CONTENT AREA                       │
│                     (Scrollable, Responsive)                 │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Panel 1: Live Location Tracker (100% width)       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Panel 2: Live Video Stream (100% width)           │    │
│  │  ├─ Video Controls                                  │    │
│  │  ├─ Dual Channel Videos (2-col on desktop, 1 mobile)    │
│  │  ├─ Statistics (2 mini-cards)                       │    │
│  │  └─ Packet Details                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Panel 3: AI Plant Health Analysis (100% width)    │    │
│  │  ├─ AI Controls (Manual & Live buttons)             │    │
│  │  ├─ Live Analysis Settings (Hidden by default)      │    │
│  │  ├─ Plant Info (2 mini-cards)                       │    │
│  │  ├─ Detailed Analysis                               │    │
│  │  ├─ Care Recommendations                            │    │
│  │  └─ Metadata                                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Design System

### Color Palette
```
Primary Gradient: 
  - From: #667eea (Iris Blue)
  - To:   #764ba2 (Purple)
  
Status Colors:
  - Connected/Good:  #10b981 (Emerald Green)
  - Error/Critical:  #ef4444 (Red)
  - Fair/Warning:    #3b82f6 (Blue)
  - Poor/Caution:    #f59e0b (Amber)

Neutral Colors:
  - White/Light:     #ffffff / rgba(255,255,255,0.95/0.97)
  - Text Primary:    #222222
  - Text Secondary:  #555555
  - Text Muted:      #777777 / #999999
  - Text Disabled:   #aaaaaa
  - Border/Divider:  #e9ecef
  - Background:      #f8f9fa

Background Gradient:
  - Full Page: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
  - Light Overlay: rgba(102, 126, 234, 0.05 to 0.1)
```

### Typography System
```
Font Family: 'Segoe UI', system-ui, Arial, sans-serif
Monospace: 'Courier New', monospace

Font Sizes:
  - h1:  1.8rem (28px) - Page Title (Bold, Gradient Text)
  - h2:  1.15rem (18px) - Section Titles
  - h3:  0.95rem (15px) - Subsection Headers
  - Body: 0.95rem (15px) - Default Text
  - Small: 0.9rem, 0.85rem, 0.82rem (14px, 13px, 13px)
  - Mini: 0.8rem (12px) - Badge Labels

Font Weights:
  - 500: Medium (Labels)
  - 600: Semibold (Section Titles, Field Labels)
  - 700: Bold (Values, Badges, Headers)
```

### Spacing & Layout
```
Page Padding: 16px (mobile), 16px (all)
Max Width: 1360px (with max-width: 1200px at 1280px breakpoint)
Gap Between Cards: 14px (horizontal flex gap)
Row Gap: 14px
Card Padding: 18px
Mini Card Padding: 14px
Field Margin: 10px vertical, 8px vertical between
Section Margin: 14px top

Border Radius:
  - Cards: 16px
  - Mini Cards: 12px
  - Buttons: 10px (main), 8px (small), 20px (badge)
  - Video Elements: 8px (video tag)
```

### Shadow System
```
Card Shadow (Default): 0 8px 32px rgba(0, 0, 0, 0.1)
Card Shadow (Hover):   0 12px 40px rgba(0, 0, 0, 0.15)
Map Container Shadow:  0 4px 12px rgba(0, 0, 0, 0.1)
Button Shadow (Primary): 0 4px 12px rgba(102, 126, 234, 0.4)
Button Shadow (Hover):   0 6px 20px rgba(102, 126, 234, 0.6)
Dot Pulse Shadow:        0 0 8px rgba(16, 185, 129, 0.6) [Connected]
Dot Error Shadow:        0 0 8px rgba(239, 68, 68, 0.6)
Badge Shadow:            0 2px 8px rgba(color, 0.3) [Various]
Video Shadow (Max):      0 16px 52px rgba(0, 0, 0, 0.45)
```

### Effects & Transitions
```
Hover Effects:
  - Cards:   transform: translateY(-4px), shadow increase
  - Buttons: transform: translateY(-2px), shadow increase
  - Video Buttons: translateY(-1px)
  - All:     0.3s ease transition

Animations:
  - Pulse (Status Dot): 2s infinite
    0%, 100%: opacity 1
    50%: opacity 0.6

Active States:
  - Buttons: transform: translateY(0) [pressed effect]
  - Disabled: opacity 0.5, cursor not-allowed
```

---

## 📦 Main Components & Sections

### 1️⃣ HEADER SECTION
**Location:** Top fixed section  
**Height:** ~80px  
**Style:** `background: rgba(255, 255, 255, 0.95)` with backdrop blur

**Contents:**
- **Title:** `🛰️ JC371 / JimiIoT — GPS Tracking & Live Monitor`
  - Font: 1.8rem, 700 weight, gradient text (purple)
  - Style: Gradient text effect with clip
- **Status Bar:**
  - Flex container with gap: 12px
  - Connection Dot: 12x12px, animated pulse
    - Connected: #10b981 with green glow
    - Disconnected: #ccc
    - Error: #ef4444 with red glow
  - Status Text: 0.9rem, color #555

---

### 2️⃣ LIVE LOCATION TRACKER CARD
**Class:** `.card .map-card`  
**Width:** 100% of content area  
**Default State:** "Waiting for GPS data..." message

**Layout Inside:**
```
┌──────────────────────────────┐
│  Live Location Tracker       │
├──────────────────────────────┤
│  [Map Container]             │
│  (Height: 340px, Leaflet)    │
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │ Device Info   Position │  │
│  │ - Device ID   - Lat    │  │
│  │ - Last Update - Lng    │  │
│  │ - Status      - Alt    │  │
│  │               - Speed  │  │
│  │               - Heading│  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

**Data Fields (3-column layout):**

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Device Information | Position & Motion | Motion Data |
| Device ID | Latitude | Speed |
| Last Update | Longitude | Heading |
| Status (Badges) | Altitude | |

**Status Badges:**
- `.badge.off` (Red): ACC OFF
- `.badge.nofix` (Orange): NO FIX

---

### 3️⃣ LIVE VIDEO STREAM CARD
**Class:** `.card`  
**Width:** 100%  
**Sections:** 5 subsections

#### 3.1 Video Controls Bar
**Style:** Linear gradient background (light purple)  
**Components:**
- **Button:** "▶ Start Video"
  - Style: Primary gradient, shadow
  - Hover: translateY(-2px)
  - Active: translateY(0)
- **Status Text:** Flex: 1, color #666, 0.9rem

#### 3.2 Dual Video Stream (2-Column)
**Layout:** 
- Desktop: 2 columns (grid `1fr 1fr`)
- Tablet (≤1024px): 1 column
- Mobile: 1 column

**Each Channel Tile:**
```
┌─────────────────────────┐
│ Channel 1 Stream        │
├─────────────────────────┤
│  [VIDEO ELEMENT]        │
│  size: 100% × 240px     │
│  ┌─ [🔇 Speaker] ┐ [⤢]  │
│  └─────────────────────┘│
│ not started (audio)     │
└─────────────────────────┘
```

**Video Elements:**
- HTML5 `<video>` tag
- autoplay, muted, playsinline, disablepictureinpicture
- Background: black
- Size: 100% width × 240px height
- Object-fit: contain
- Border-radius: 8px
- Class: `.video-shell` (position: relative, z-index container)

**Video Overlay Controls (Top-Right):**
- Position: absolute, top: 8px, right: 8px
- z-index: 3
- Gap: 8px
- **Speaker Button:** "🔇 Speaker"
  - Disabled until video plays
  - Controls audio output
- **Maximize Button:** "⤢ Maximize"
  - Toggles fullscreen mode
  - Class: `.video-ctrl-btn`

**Audio Status Indicator:**
- Font: 0.82rem, color #666
- Margin-top: 8px
- Min-height: 18px
- States: "not started" → "playing" → "stopped"

**Maximized Video Mode:**
- `.video-shell.maximized`
- Position: fixed, inset: 28px (all sides)
- Width/Height: calc(100vw - 56px) / calc(100vh - 56px)
- z-index: 9999
- Border-radius: 12px
- Box-shadow: 0 16px 52px rgba(0, 0, 0, 0.45)

#### 3.3 Stream Statistics
**Title:** "Stream Statistics"  
**Layout:** 2-column mini cards

**Each Mini Card:**
```
┌──────────────────┐
│ Channel 1        │
├──────────────────┤
│ Data:   [value]  │
│ Packets:[value]  │
│ Last Rx:[value]  │
└──────────────────┘
```

**Mini Card Styling:**
- Border: 1px solid #e9ecef
- Border-radius: 12px
- Padding: 14px
- Background: light gradient (rgba purple 0.05)
- Class: `.mini`

**Fields:**
- Data (bytes received)
- Packets (count)
- Last Rx (timestamp)

#### 3.4 Packet Details
**Title:** "Packet Details"  
**Layout:** 4 field rows

**Fields:**
- Device
- Channel
- Type
- Size

---

### 4️⃣ AI PLANT HEALTH ANALYSIS CARD
**Class:** `.card`  
**Width:** 100%  
**New Feature:** Real-time plant health monitoring

#### 4.1 AI Controls Bar
**Style:** Linear gradient background (light purple)  
**Height:** Auto, padding: 12px 16px  
**Components:**

1. **Manual Analysis Button:** "📷 Analyze from Camera"
   - Disabled until video plays
   - Primary gradient
   - Single-frame analysis
   - Show status messages

2. **Live Analysis Toggle Button:** "🔴 Live Analysis OFF"
   - Initial state: Disabled (red), opacity 0.6
   - When enabled: "🟢 Live Analysis ON" (green), opacity 1.0
   - Continuous real-time analysis
   - Configurable interval

3. **Status Display:** `#analyzeStatus`
   - Font: 0.9rem
   - Dynamic messages:
     - "Capturing frame..."
     - "Sending to AI for analysis..."
     - "✅ Analysis complete"
     - "🔴 Live (3s interval)"

#### 4.2 Live Analysis Settings (Hidden by Default)
**ID:** `#liveAnalysisSettings`  
**Display:** Flex container with alignment  
**Background:** rgba(102, 126, 234, 0.1)  
**Border-radius:** 12px  
**Padding:** 12px 16px  
**Margin-bottom:** 12px  

**Contents:**
```
┌────────────────────────────────────────┐
│ Interval: [Every 3 seconds ▼]          │
│            ☑ Auto-update results       │
└────────────────────────────────────────┘
```

**Interval Selector:**
- Dropdown select element
- Padding: 6px 10px
- Border: 1px solid #e9ecef
- Border-radius: 6px
- Options:
  - Every 2 seconds (2000ms)
  - Every 3 seconds (3000ms) - **DEFAULT**
  - Every 5 seconds (5000ms)
  - Every 10 seconds (10000ms)

**Auto-Update Checkbox:**
- Margin-left: 20px
- Margin-right on checkbox: 6px
- Label color: #555
- Default: **CHECKED**
- When checked: UI updates with each analysis result
- When unchecked: Results process but don't display

#### 4.3 No Data State
**ID:** `#aiNoData`  
**Display:** Initially visible  
**Style:** 
- Color: #aaa (muted)
- Font-style: italic
- Padding: 20px
- Text-align: center

**Message:**
```
"Select a video channel and click "Analyze from Camera" 
to scan for plants and analyze health status."
```

#### 4.4 Analysis Results Panel
**ID:** `#aiAnalysisResult`  
**Display:** Initially hidden (shown when analysis complete)  
**Layout:** 3 sections

##### 4.4.1 Plant Information (2-Column Mini Cards)

**Left Card: Plant Information**
```
┌──────────────────────────┐
│ Plant Information        │
├──────────────────────────┤
│ Common Name:    [value]  │
│ Scientific Name:[value]  │
│ Soil Condition: [value]  │
└──────────────────────────┘
```

**Right Card: Health Status**
```
┌──────────────────────────┐
│ Health Status            │
├──────────────────────────┤
│ Status:    [BADGE]       │
│ Health Rating:           │
│ [████░░░░░] 65%          │
└──────────────────────────┘
```

**Health Rating Bar:**
- Container: height 24px, background #e9ecef, border-radius 12px
- Fill: Linear gradient (red → amber → green)
- Gradient stops: `90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%`
- Width: 0-100% based on rating
- Transition: width 0.3s ease
- Display: flex with 12px gap to percentage text

**Health Status Badge Colors:**
- ≥70%: `.badge.on` (Green gradient)
- 50-69%: `.badge.fix` (Blue gradient)
- 30-49%: `.badge.nofix` (Orange gradient)
- <30%: `.badge.error` (Red gradient)

##### 4.4.2 Detailed Analysis Section
**Style:** Mini card (border, padding, light gradient)  
**Title:** "Detailed Analysis"  
**Content:**
- ID: `#aiDetailedAnalysis`
- Font: 0.95rem, line-height 1.6, color #555
- Margin: 0
- Text wrapping enabled
- Up to 500+ characters of AI analysis text

##### 4.4.3 Care Recommendations Section
**Style:** Mini card (margin-top 16px)  
**Title:** "💡 Care Recommendations"  
**Content:**
- ID: `#aiCareAdvice`
- HTML: `<ul>` list, padding-left 20px
- Styling: list-style none (custom bullets via margins)
- Each item: li element
  - Margin: 8px 0
  - Color: #555
  - Font: 0.95rem
- Rendering: 3-5 advice items from AI
- Empty state: "No advice available" (color #aaa)

##### 4.4.4 Metadata Footer
**Style:** Border-top 1px solid #e9ecef, margin-top 16px, padding-top 12px  
**Content:**
- Font: 0.85rem, color #999
- Text: "Analysis timestamp: `[ISO timestamp]`"
- Format: ISO 8601 (e.g., 2024-06-26T14:32:45.123Z)

---

## 🔘 Button Styles & States

### Primary Button Style
```css
/* Default */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
color: white
padding: 10px 24px
border: none
border-radius: 10px
font-size: 0.95rem
font-weight: 600
box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4)
cursor: pointer
transition: all 0.3s ease

/* Hover */
transform: translateY(-2px)
box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6)

/* Active/Pressed */
transform: translateY(0)

/* Disabled */
opacity: 0.6
cursor: not-allowed
```

### Small Video Control Buttons (`.video-ctrl-btn`)
```css
/* Default */
background: rgba(20, 20, 20, 0.62)
color: white
border: 1px solid rgba(255, 255, 255, 0.55)
border-radius: 8px
padding: 6px 10px
font-size: 0.8rem
font-weight: 600
cursor: pointer
backdrop-filter: blur(5px)
transition: background 0.2s ease, transform 0.2s ease

/* Hover (not disabled) */
background: rgba(20, 20, 20, 0.82)
transform: translateY(-1px)

/* Disabled */
opacity: 0.5
cursor: not-allowed
```

### Badge Styles (`.badge`)
```css
/* Base */
display: inline-block
padding: 4px 12px
border-radius: 20px
font-size: 0.8rem
font-weight: 700
text-transform: uppercase
letter-spacing: 0.5px

/* Variants */
.badge.on:
  background: linear-gradient(135deg, #10b981, #059669)
  color: white
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3)

.badge.off:
  background: linear-gradient(135deg, #ef4444, #dc2626)
  color: white
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3)

.badge.fix:
  background: linear-gradient(135deg, #3b82f6, #2563eb)
  color: white
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3)

.badge.nofix:
  background: linear-gradient(135deg, #f59e0b, #d97706)
  color: white
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3)

.badge.error:
  background: linear-gradient(135deg, #ef4444, #dc2626)
  color: white
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3)
```

---

## 🎯 Data Field Display Pattern

**Standard Field Row:**
```html
<div class="field">
  <span class="label">Field Label</span>
  <span class="value">Field Value</span>
</div>
```

**Styling:**
- Display: flex, justify-content: space-between
- Margin: 10px vertical, 8px vertical (v2)
- Padding: 8px vertical
- Border-bottom: 1px solid rgba(0,0,0,0.05)
- Last field: no border-bottom
- Font-size: 0.95rem

**Label Styling:**
- Class: `.label`
- Color: #777
- Font-weight: 500

**Value Styling:**
- Class: `.value`
- Font-weight: 700
- Gradient text (purple) OR solid color
- Text-align: right
- Overflow: auto (if long)

---

## 📱 Responsive Design Rules

### Breakpoints
```css
/* Default: Desktop (1280px+) */
max-width: 1360px
.two-col: grid-template-columns 1fr 1fr

/* Tablet (1024px and below) */
.two-col: grid-template-columns 1fr (single column)
max-width: 1200px

/* Mobile (No specific breakpoint enforced, flexible) */
.card: min-width 300px (flex basis)
.row: flex-wrap wrap with gap 14px
```

### Flex Behavior
- Cards use `flex: 1` with `min-width: 300px` for responsive wrapping
- Two-column section uses CSS Grid with media query
- All components stack on smaller screens
- Video tiles: 2-col on desktop, 1-col on tablet+

---

## 🎬 Interactive States

### Video Stream States
1. **Not Started**
   - Audio status: "not started"
   - Speaker button: disabled
   - Video element: showing black/placeholder

2. **Playing**
   - Audio status: "playing" or "stopped" (audio toggle state)
   - Speaker button: enabled
   - Maximize button: enabled
   - Video: live stream display

3. **Maximized**
   - Video element: fixed position, full viewport
   - z-index: 9999 (above all)
   - Can minimize back to original view

### AI Analysis States

**Manual Analysis:**
1. Initial: Button enabled when video ready
2. Clicked: Show "Capturing frame..."
3. Processing: Show "Sending to AI..."
4. Complete: Show "✅ Analysis complete" + Results
5. Auto-reset: After 2s delay

**Live Analysis:**
1. OFF (default): Red button, opacity 0.6
2. Activated: Green button, opacity 1.0, settings appear
3. Running: Every N seconds (2-10s)
   - Interval adjustable without stopping
   - In-flight lock prevents overlapping requests
4. Stopped: Back to OFF state, settings hidden

---

## 🗂️ Data Structures & Formats

### GPS Data Display
```javascript
{
  gDevice: "SIM888/JC371",      // Device identifier
  gTime: "2024-06-26 14:32:45",  // Timestamp
  gACC: "ON/OFF",                // Engine status
  gFix: "2D/3D/NO FIX",          // GPS fix type
  gLat: "22.2745° N",            // Latitude
  gLng: "114.1895° E",           // Longitude
  gAlt: "45.2m",                 // Altitude
  gSpeed: "0 km/h",              // Current speed
  gHeading: "180°",              // Direction heading
}
```

### Video Stream Stats
```javascript
{
  ch1Bytes: "1.2 MB",            // Total data received
  ch1Packets: "512",             // Packet count
  ch1Last: "0.2s ago",           // Last packet time
  vDevice: "SIM888",             // Device ID
  vChannel: "1",                 // Stream channel
  vType: "H.264",                // Video codec
  vSize: "4096 bytes",           // Last packet size
}
```

### AI Analysis Result
```javascript
{
  ok: true,
  analysis: {
    plantName: "Monstera Deliciosa",
    scientificName: "Rhaphidophora pinnata",
    soilCondition: "Slightly moist, good drainage",
    plantHealthRating: 78,           // 0-100%
    healthStatus: "Healthy",         // Status text
    detailedAnalysis: "The plant appears...",  // Long text
    careAdvice: [                    // Array of strings
      "Water when soil is 50% dry",
      "Ensure bright, indirect light",
      "Feed monthly during growing season"
    ]
  },
  timestamp: "2024-06-26T14:32:45.123Z"
}
```

---

## 🎪 Visual Indicators & Status Icons

### Connection Status (Header)
- **🔴 Red + Pulsing:** Connected (Green with glow)
- **⚪ Gray:** Disconnected
- **🔴 Red + Glow:** Error/Connection Lost

### GPS Status Badges (Location Card)
- `.badge.off` - Red: ACC OFF (engine off)
- `.badge.nofix` - Orange: NO FIX (no satellite lock)

### Video Controls
- 🔇 Speaker (muted indicator)
- ⤢ Maximize/Fullscreen toggle

### AI Health Status Badges
- 🟢 Healthy (≥70%): Green gradient
- 🔵 Fair (50-69%): Blue gradient
- 🟠 Poor (30-49%): Orange gradient
- 🔴 Critical (<30%): Red gradient

### Analysis Mode Indicators
- 🔴 Red: Live OFF
- 🟢 Green: Live ON
- 📷 Camera: Manual capture
- 🌿 Plant: AI health analysis

---

## 💬 Text Content Patterns

### Placeholders & Empty States
```
GPS Data:       "Waiting for GPS data..."
AI Analysis:    "Select a video channel and click "Analyze 
                 from Camera" to scan for plants and analyze 
                 health status."
Video Status:   "not started"
No Advice:      "No advice available"
No Care Tips:   "No care recommendations available"
Loading:        "Capturing frame...", "Sending to AI..."
Complete:       "✅ Analysis complete"
Error:          "⚠ Failed to capture frame"
Live Mode:      "🔴 Live (3s interval)"
```

### Field Labels
```
Device ID
Last Update
Status
Latitude
Longitude
Altitude
Speed
Heading
Common Name
Scientific Name
Soil Condition
Health Status
Health Rating
Detailed Analysis
Care Recommendations
Analysis timestamp
```

---

## 🎭 Animation & Transition Timeline

### Fade/Show Elements
```
Duration: 0.3s ease
Effect: opacity 0-1, smooth transition
Elements: Cards (on hover), results (on load)
```

### Button Interactions
```
Hover:   translateY(-2px)  → 0.3s ease
Active:  translateY(0)     → immediate
Disabled: opacity 0.6      → immediate
```

### Status Dot Pulse
```
Animation: pulse 2s infinite
0%, 100%: opacity 1
50%:      opacity 0.6
```

### Live Analysis Updates
```
Result Display: fade in/update
Transition: 0.3s ease on health bar width
Interval: Every 2-10 seconds (user configurable)
```

---

## 🔒 Accessibility & Semantic HTML

### ARIA Labels
```html
<button aria-label="Toggle speaker">🔇 Speaker</button>
<button aria-label="Toggle maximize">⤢ Maximize</button>
<button aria-pressed="false">🔇 Speaker</button>
```

### Semantic Elements
- `<h1>` - Page title
- `<h2>` - Section titles
- `<h3>` - Subsection headers
- `<video>` - Video elements with controls
- `<pre>` - Code/data display
- `<ul>` - Care advice list
- `<select>` - Interval dropdown
- `<input type="checkbox">` - Auto-update toggle

### Color Contrast
- All text meets WCAG AA minimum (4.5:1)
- Status indicators have additional text labels
- Icons accompanied by text descriptions

---

## 📊 Layout Grid Reference

### Main Container
```
max-width: 1360px
padding: 16px
margin: 0 auto
```

### Card Grid
```
flex: 1
min-width: 300px (ensures wrapping on mobile)
flex-wrap: wrap
gap: 14px
```

### Two-Column Grid
```
grid-template-columns: 1fr 1fr (desktop)
grid-template-columns: 1fr (≤1024px)
gap: 16px
```

### Video Grid (2-col)
```
grid-template-columns: 1fr 1fr (desktop)
gap: 16px
```

---

## 🎯 Component Library Summary

| Component | Type | Usage | State Count |
|-----------|------|-------|-------------|
| Card | Container | Main content sections | 1 (hover) |
| Mini Card | Container | Data grouping | 1 (hover) |
| Button | Interactive | Actions | 4 (default, hover, active, disabled) |
| Badge | Visual | Status indicator | 5 (on, off, fix, nofix, error) |
| Field | Display | Data pair | 1 |
| Status Dot | Visual | Connection indicator | 3 (connected, disconnected, error) |
| Health Bar | Visual | Rating display | 1 (animated fill) |
| Dropdown | Interactive | Option selection | 1 |
| Checkbox | Interactive | Toggle option | 2 (checked, unchecked) |
| Video Element | Media | Stream display | 3 (not started, playing, maximized) |
| Video Control | Interactive | Video actions | 3 (default, hover, disabled) |

---

## 📐 Complete File Structure

```
📁 dashboard-web/
├── 📄 index.html (UI Structure + Inline CSS)
├── 📄 dashboard-client.js (Logic & Interactivity)
├── 🖼️ [leaflet-map] (External library)
├── 🎬 [flv.js] (External library - video player)
└── 📚 [Other assets]
```

---

## 🔄 Data Flow & Real-Time Updates

### GPS Location Updates
```
WebSocket GPS Data → Dashboard Updates
Update Frequency: Real-time as data arrives
Display: Map marker + data fields
```

### Video Stream Updates
```
HLS/RTSP Stream → FLV.js Player → Video Elements
Channels: Dual (Channel 1, Channel 2)
Controls: Speaker toggle, Maximize
```

### AI Analysis Updates (Live Mode)
```
Interval Timer → Frame Capture → AI API → Display Result
Frequency: 2-10 seconds (configurable)
In-Flight Lock: Prevents overlapping requests
Auto-Update: Optional UI refresh
```

---

## 🚀 Performance Considerations

### Optimization Points
1. **Images/Videos:** Lazy loading where applicable
2. **CSS:** Gradient backgrounds optimized
3. **Animations:** GPU-accelerated transforms
4. **Shadows:** Hardware rendering via webkit
5. **Backdrop Filter:** Limited use (blur effects)
6. **Grid/Flex:** Modern layout techniques
7. **Frame Capture:** Canvas 2D context reuse
8. **API Calls:** In-flight lock prevents queue buildup

---

*Document Generated: 2024-06-26*  
*For UI/UX Redesign with AI Tools*
