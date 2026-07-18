# Custodia AI — PRD

## Original problem statement
> I want you change the clinic locations to hyderabad. Also the ai agent should analyze the health issue and generate its own response

## Architecture
- **Frontend (`/app/frontend/`)** — Next.js 14 app (React 18, Tailwind, Leaflet map, voice input in 6 languages).
  Runs `next dev -p 3000 -H 0.0.0.0` via supervisor.
- **Backend (`/app/backend/`)** — FastAPI (uvicorn on 0.0.0.0:8001) with two responsibilities:
  1. `POST /api/triage-ai` — real AI triage via `emergentintegrations.LlmChat` + Gemini `gemini-2.5-flash` using the Emergent Universal LLM Key.
  2. Catch-all proxy: forwards every other `/api/*` request to the Next.js dev server so existing session/clinic/appointment/transport/tracking/report endpoints keep working.
- **Ingress**: `/api/*` → :8001 (FastAPI), everything else → :3000 (Next.js).

## User personas
- Rural / peri-urban patients in Hyderabad & Telangana needing quick symptom assessment.
- Community health workers looking for the nearest clinic and transport.

## Core requirements (static)
1. Triage the patient's symptoms with real AI (not templated rules).
2. Suggest the nearest clinic in Hyderabad with distance + ETA.
3. Book appointment, dispatch transport, track vehicle, generate report.
4. Multilingual (English, Hindi, Tamil, Telugu, Kannada, Malayalam).

## Implemented (2026-01-18)
- Moved Next.js app to `/app/frontend/`, created FastAPI backend at `/app/backend/`.
- Wired Emergent Universal LLM Key → Gemini 2.5 Flash for `/api/triage-ai`.
- `lib/agents.js::triageAgent` now calls the Python endpoint; rule-based fallback only runs on failure.
- 5 clinics already in Hyderabad (Himayatnagar, Secunderabad, Dilsukhnagar, Jubilee Hills, Kukatpally).
- Default user location + geolocation-denied fallback set to Hyderabad (17.3850, 78.4867).
- Fixed pre-existing `app/layout.js` syntax error (stray `}`) and removed unused `next-themes` import.
- End-to-end tested: unique AI diagnoses per symptom, emergency triggers 108/112 advice, all clinics resolve within Hyderabad.

## Backlog
- **P1**: Move image analysis (`/api/analyze-image`) to the Python backend so it also uses the Emergent Universal Key (currently still uses `@google/generative-ai` SDK, requires a separate `GEMINI_API_KEY`).
- **P1**: Persist sessions to MongoDB instead of local `data/sessions.json` (backend has `MONGO_URL` ready).
- **P2**: Streaming triage response (SSE) for a snappier UX.
- **P2**: Doctor tele-consult booking after triage.
- **P2**: SMS / WhatsApp reminders via Twilio for medication schedule.
