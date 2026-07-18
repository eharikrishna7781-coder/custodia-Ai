# Custodia AI

**AI-powered rural healthcare access system** — Voice-first, multi-agent assistant that guides patients from symptom detection to recovery.

[![Vercel Deployment](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://custodia-ai-9n9x.vercel.app)
[![Next.js](https://img.shields.io/badge/Built%20with-Next.js%2014-black?logo=next.js)](https://nextjs.org)
[![Gemini AI](https://img.shields.io/badge/Powered%20by-Gemini%20AI-blue?logo=google)](https://ai.google.dev)

---

## What's New in v0.2.0

### New Features
- **Dark Mode** — Toggle between light and dark themes
- **Emergency SOS** — One-tap emergency contact panel with 112, 108, and other helplines
- **Health Tips** — Daily preventive healthcare tips for rural communities
- **Real Gemini Vision** — AI-powered image analysis for rashes, wounds, bites
- **PWA Support** — Install as app, works offline with service worker
- **Medicine Reminders** — Track medications with check-off reminders
- **Multi-language Voice Input** — Speech recognition in Hindi, Tamil, Telugu, Kannada, Malayalam
- **Voice Output Toggle** — Enable/disable text-to-speech
- **Language Selector** — Switch between 6 languages from the header
- **Push Notifications** — Medicine reminder notifications (with browser permission)
- **Online/Offline Detection** — Shows connection status

### Bug Fixes
- Fixed duplicate CSS in `globals.css`
- Fixed duplicate config in `tailwind.config.js`
- Fixed MapComponent cleanup bug that caused map to disappear
- Added proper error handling throughout the app
- Fixed session persistence with validation
- Added retry logic for Gemini API calls
- Fixed voice recognition for all supported languages

### Improvements
- **Better Error Handling** — Toast notifications for errors, graceful fallbacks
- **Loading States** — Skeleton screens and typing indicators
- **Map Enhancements** — Route display, distance labels, recenter button, clinic info overlay
- **Accessibility** — ARIA labels, keyboard navigation, focus management
- **Performance** — Service worker caching, optimized re-renders
- **Session Management** — Automatic cleanup of old sessions, activity tracking
- **UI Polish** — Smooth animations, responsive design, better spacing

---

## Quick Start

### Prerequisites
- Node.js 18+ 
- Gemini API key from [Google AI Studio](https://aistudio.google.com)

### Setup

```bash
# Clone the repository
git clone https://github.com/eharikrishna7781-coder/custodia-Ai.git
cd custodia-Ai

# Install dependencies
npm install

# Add your Gemini API key
echo "GEMINI_API_KEY=your_api_key_here" > .env.local

# Run development server
npm run dev

# Open http://localhost:3000
```

### Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## Architecture

### 7 Specialized Agents

| Agent | Function | Status |
|-------|----------|--------|
| **Triage Agent** | Symptom analysis with Gemini AI | ✅ Active |
| **Locator Agent** | Find nearest clinics with stock info | ✅ Active |
| **Booking Agent** | Appointment scheduling | ✅ Active |
| **Transport Agent** | Ambulance/volunteer dispatch | ✅ Active |
| **Navigation Agent** | Live GPS tracking on map | ✅ Active |
| **Vision Agent** | Image analysis with Gemini Vision | ✅ Active |
| **Report Agent** | Generate medical reports | ✅ Active |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| UI | React 18 + Tailwind CSS 3 |
| Maps | Leaflet + React-Leaflet |
| AI | Google Gemini 1.5 Flash (text + vision) |
| Voice | Web Speech API (STT + TTS) |
| Icons | Lucide React |
| State | React Hooks + localStorage |
| PWA | Service Worker + Web Manifest |

### Supported Languages

- English
- Hindi (हिंदी)
- Tamil (தமிழ்)
- Telugu (తెలుగు)
- Kannada (ಕನ್ನಡ)
- Malayalam (മലയാളം)

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/init` | POST | Initialize session, triage symptoms |
| `/api/appointment` | POST | Book clinic appointment |
| `/api/transport` | POST | Arrange transport |
| `/api/tracking/[session]` | GET | Get vehicle tracking data |
| `/api/report/[session]` | GET | Generate patient report |
| `/api/analyze-image` | POST | Analyze medical images |
| `/api/debug/sessions` | GET | Debug: view all sessions |

---

## Project Structure

```
custodia-ai/
├── app/
│   ├── api/                    # API routes
│   │   ├── analyze-image/      # Vision analysis
│   │   ├── appointment/        # Booking
│   │   ├── debug/sessions/     # Debug
│   │   ├── init/               # Session + triage
│   │   ├── report/[session]/   # Reports
│   │   ├── tracking/[session]/ # Live tracking
│   │   └── transport/          # Transport booking
│   ├── globals.css             # Global styles + animations
│   ├── layout.js               # Root layout + PWA meta
│   └── page.js                 # Main app component
├── components/
│   ├── MapComponent.js         # Interactive map
│   └── StepProgress.js         # Progress indicator
├── lib/
│   ├── agents.js               # 7 agent implementations
│   ├── translations.js         # i18n (6 languages)
│   ├── useServiceWorker.js     # PWA hooks
│   └── visualAnalysis.js       # Gemini Vision integration
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service worker
│   └── icons/                  # App icons
├── next.config.js              # Next.js config
├── tailwind.config.js          # Tailwind + dark mode
└── package.json
```

---

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set `GEMINI_API_KEY` in Vercel Environment Variables.

### Manual

```bash
npm run build
npm start
```

---

## Offline Support

Custodia AI works offline after the first visit:

- **Cached Pages**: Main app shell is cached for instant load
- **Service Worker**: Handles offline requests gracefully
- **Local Storage**: Symptom history and medicine reminders persist locally
- **Voice**: Speech recognition works offline (browser-dependent)

> Note: AI features (Gemini API calls) require internet connection.

---

## Security Notes

- Never commit `.env.local` to version control
- The debug endpoint (`/api/debug/sessions`) should be disabled in production
- Session data is stored in-memory and periodically persisted to disk
- All image analysis is done server-side to protect API keys

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is open source and available under the MIT License.

---

## Acknowledgments

- Google Gemini AI for powering the medical analysis
- OpenStreetMap contributors for map data
- The rural healthcare workers who inspired this project

---

**Custodia AI** — *Healthcare, in your language, at your fingertips.* 🏥
