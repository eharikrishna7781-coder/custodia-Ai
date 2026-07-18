"""
FastAPI backend for Custodia AI.

Two responsibilities:
1. Real AI triage endpoint powered by Gemini via the Emergent Universal LLM Key.
2. Transparent proxy for every other /api/* request forwarded to the Next.js
   dev server on localhost:3000 (which owns session state, clinics, appointment,
   transport, tracking and report endpoints).

Runs on 0.0.0.0:8001, matching the platform's ingress rule that maps /api/* -> 8001.
"""
import json
import os
import re
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv(Path(__file__).parent / ".env")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
NEXTJS_INTERNAL_URL = os.environ.get("NEXTJS_INTERNAL_URL", "http://localhost:3000")

app = FastAPI(title="Custodia AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Utilities ----------
def clean_markdown(text):
    if not text:
        return text
    return (
        re.sub(r"\*\*|\*|__|`|~|#+\s+", "", text)
        .replace("- ", "")
        .strip()
    )


def extract_json(raw):
    if not raw:
        return None
    cleaned = raw.replace("```json", "").replace("```", "").strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(cleaned[start:end + 1])
        except Exception:
            return None
    return None


LANG_NAMES = {
    "en": "English", "hi": "Hindi", "ta": "Tamil",
    "te": "Telugu", "kn": "Kannada", "ml": "Malayalam",
}


# ---------- Real AI Triage ----------
@app.post("/api/triage-ai")
async def triage_ai(request: Request):
    body = await request.json()
    symptoms = (body.get("symptoms") or "").strip()
    lang = body.get("lang", "en")
    lang_name = LANG_NAMES.get(lang, "English")

    if not symptoms:
        return JSONResponse({"error": "symptoms required"}, status_code=400)

    if not EMERGENT_LLM_KEY:
        return JSONResponse({"error": "LLM key not configured"}, status_code=500)

    system_message = (
        "You are Custodia AI, a medical triage assistant designed for rural and urban "
        "healthcare access in India (Hyderabad and surrounding Telangana region). "
        "You analyze patient symptoms and return a rigorous, patient-specific "
        "assessment. You DO NOT return generic templates. Every response must be "
        "explicitly derived from the exact symptoms provided. "
        "You always respond with a single valid JSON object, nothing else. "
        "No markdown, no code fences, no commentary."
    )

    prompt = f"""Patient symptoms (verbatim): "{symptoms}"

Analyze THIS specific case. Consider common tropical / rural / urban Indian conditions:
malaria, dengue, typhoid, chikungunya, respiratory infections (TB, pneumonia, bronchitis, COVID-like),
gastroenteritis, dysentery, worms, skin conditions (scabies, fungal, allergic), maternal & child health,
diabetes/hypertension complications, injuries, snake/insect bites, food poisoning, heat stroke.

Return ONLY valid JSON with these EXACT fields (all text in {lang_name}):
{{
  "diagnosis": "Most likely condition(s) with brief clinical reasoning tied to the reported symptoms",
  "urgency_score": <integer 1-5 where 1=self-care, 3=see doctor soon, 5=life-threatening emergency>,
  "needs_doctor": <true|false>,
  "advice": "Direct, actionable advice for this patient in simple language",
  "suggested_medicines": [
    {{"name": "generic name (brand in brackets if useful)", "dosage": "e.g. 500mg", "type": "OTC or prescription", "frequency": "e.g. every 6 hours", "duration": "e.g. 3 days", "timing": "e.g. after food"}}
  ],
  "care_instructions": "Concrete home-care steps: rest, diet, hydration, red flags to watch for, when to escalate"
}}

Rules:
- Analyze the EXACT symptoms above. Do not return generic advice.
- needs_doctor MUST be true if urgency_score >= 4 or serious condition suspected.
- If urgency is 5 (chest pain, severe bleeding, unconscious, breathing failure, stroke signs), advice must direct to call 108 / 112 immediately.
- suggested_medicines can be empty [] for emergencies where self-medication is unsafe.
- Never invent prescription-only drugs for minor symptoms; prefer OTC.
- Respond in {lang_name}. NO markdown symbols anywhere."""

    session_id = str(uuid.uuid4())
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model("gemini", "gemini-2.5-flash")

    try:
        raw = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        return JSONResponse({"error": f"LLM call failed: {e}"}, status_code=502)

    parsed = extract_json(raw)
    if not parsed:
        return JSONResponse(
            {"error": "Could not parse LLM response", "raw": raw[:500] if raw else ""},
            status_code=502,
        )

    # Sanitize all text fields
    parsed["diagnosis"] = clean_markdown(parsed.get("diagnosis", ""))
    parsed["advice"] = clean_markdown(parsed.get("advice", ""))
    parsed["care_instructions"] = clean_markdown(parsed.get("care_instructions", ""))
    meds = parsed.get("suggested_medicines") or []
    for m in meds:
        for k in ("name", "dosage", "type", "frequency", "duration", "timing"):
            if k in m and isinstance(m[k], str):
                m[k] = clean_markdown(m[k])
    parsed["suggested_medicines"] = meds

    return parsed


@app.get("/api/health")
async def health():
    return {"status": "ok", "llm_configured": bool(EMERGENT_LLM_KEY)}


# ---------- Catch-all proxy to Next.js for all other /api/* routes ----------
@app.api_route(
    "/api/{full_path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
)
async def proxy_to_nextjs(full_path: str, request: Request):
    target_url = f"{NEXTJS_INTERNAL_URL}/api/{full_path}"
    if request.url.query:
        target_url += f"?{request.url.query}"

    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")}

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            upstream = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
            )
        except httpx.RequestError as e:
            return JSONResponse({"error": f"upstream unreachable: {e}"}, status_code=502)

    response_headers = {
        k: v for k, v in upstream.headers.items()
        if k.lower() not in ("content-encoding", "transfer-encoding", "content-length", "connection")
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )
