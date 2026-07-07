import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import translations, { getTranslation } from './translations';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const sessions = new Map();
const SESSIONS_DIR = path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(SESSIONS_DIR, 'sessions.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  } catch (_) {}
}

function loadSessionsFromDisk() {
  try {
    ensureDataDir();
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
      const obj = JSON.parse(raw || '{}');
      sessions.clear();
      Object.entries(obj).forEach(([k, v]) => sessions.set(k, v));
    }
  } catch (_) {}
}

function saveSessionsToDisk() {
  try {
    ensureDataDir();
    const obj = Object.fromEntries(sessions);
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (_) {}
}

loadSessionsFromDisk();

const CLINICS = [
  { id: 1, name: 'Primary Health Centre A', lat: 12.98, lng: 77.6, stock: 80, specialists: 2 },
  { id: 2, name: 'Community Clinic B', lat: 12.96, lng: 77.61, stock: 60, specialists: 1 },
  { id: 3, name: 'Rural Hospital C', lat: 12.99, lng: 77.58, stock: 90, specialists: 4 },
  { id: 4, name: 'Urban Care Hospital', lat: 12.97, lng: 77.59, stock: 88, specialists: 5 },
];

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function callGemini(prompt) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini error:', error);
    return null;
  }
}

function extractJsonPayload(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch (_) {
      return null;
    }
  }
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    return null;
  }
}

function triageFallback(symptoms, lang = 'en') {
  const text = (symptoms || '').toLowerCase();
  const t = translations[lang] || translations.en;

  if (/chest|breath|unconscious|bleeding|severe|poison|snake/.test(text)) {
    return {
      score: 5,
      advice: t.triage.critical,
      needsDoctor: true,
      diagnosis: 'Possible urgent medical issue requiring immediate evaluation.',
      suggestedMedicines: [],
      careInstructions: 'Seek emergency help immediately and do not delay medical care.',
    };
  }

  if (/high fever|vomit|severe headache|severe pain|stomach pain|diarrhea|dehydration/.test(text)) {
    return {
      score: 4,
      advice: t.triage.high,
      needsDoctor: true,
      diagnosis: 'Possible infection or acute illness that should be checked by a doctor.',
      suggestedMedicines: [
        { name: 'Paracetamol', dosage: '500 mg', type: 'OTC', frequency: 'every 6 hours if needed', duration: '2-3 days', timing: 'after food' },
      ],
      careInstructions: 'Rest, drink fluids, and seek medical care if symptoms worsen or persist.',
    };
  }

  if (/fever|cough|cold|headache|body pain/.test(text)) {
    return {
      score: 3,
      advice: t.triage.medium,
      needsDoctor: false,
      diagnosis: 'Likely viral fever, cold, or flu-like illness.',
      suggestedMedicines: [
        { name: 'Paracetamol', dosage: '500 mg', type: 'OTC', frequency: 'every 6 hours if needed', duration: '2-3 days', timing: 'after food' },
        { name: 'Oral rehydration solution', dosage: '1 glass', type: 'OTC', frequency: '2-3 times a day', duration: '1-2 days', timing: 'between meals' },
      ],
      careInstructions: 'Rest, stay hydrated, and monitor temperature. Seek care if symptoms persist beyond 3 days.',
    };
  }

  if (/rash|allergy|itch/.test(text)) {
    return {
      score: 2,
      advice: t.triage.low,
      needsDoctor: false,
      diagnosis: 'Possible mild allergy or skin irritation.',
      suggestedMedicines: [
        { name: 'Antihistamine', dosage: '1 tablet', type: 'OTC', frequency: 'once daily', duration: '2 days', timing: 'at night or as directed' },
      ],
      careInstructions: 'Avoid the trigger, keep the skin clean, and seek care if the rash spreads or worsens.',
    };
  }

  return {
    score: 2,
    advice: t.triage.low,
    needsDoctor: false,
    diagnosis: 'Possible mild condition that can often be managed with rest and hydration.',
    suggestedMedicines: [
      { name: 'Paracetamol', dosage: '500 mg', type: 'OTC', frequency: 'every 6 hours if needed', duration: '1-2 days', timing: 'after food' },
    ],
    careInstructions: 'Rest, drink fluids, and seek medical help if symptoms worsen.',
  };
}

export async function triageAgent(symptoms, lang = 'en') {
  const langName = lang === 'hi' ? 'Hindi' : lang === 'ta' ? 'Tamil' : lang === 'te' ? 'Telugu' : lang === 'kn' ? 'Kannada' : lang === 'ml' ? 'Malayalam' : 'English';
  const prompt = `
You are a medical assistant for rural India.
Analyze these symptoms: "${symptoms}"

Return only valid JSON with these fields:
{
  "diagnosis": "brief description of the most likely condition(s)",
  "urgency_score": 1-5 (1=low, 5=critical),
  "needs_doctor": true/false,
  "advice": "clear, simple medical advice",
  "suggested_medicines": [
    {
      "name": "medicine name",
      "dosage": "how much to take (e.g., 1 tablet, 10ml syrup)",
      "type": "OTC/prescription",
      "frequency": "how often (e.g., every 6 hours, twice daily)",
      "duration": "for how many days",
      "timing": "with/without food, morning/night"
    }
  ],
  "care_instructions": "home care steps, rest, diet, hydration, when to see a doctor again"
}

Important rules:
- Focus first on identifying the likely health issue and the medicine guidance.
- Set "needs_doctor" to true only if the symptoms suggest urgent care, severe symptoms, or a condition that likely needs medical evaluation.
- If "needs_doctor" is false, do not suggest a clinic and keep the advice focused on home care.
- Respond in ${langName}. Use only valid JSON, with no markdown or explanations.
`;
  const response = await callGemini(prompt);
  try {
    const parsed = extractJsonPayload(response) || {};
    const fallback = triageFallback(symptoms, lang);
    const needsDoctor = parsed.needs_doctor ?? fallback.needsDoctor;
    const suggestedMedicines = Array.isArray(parsed.suggested_medicines) && parsed.suggested_medicines.length > 0
      ? parsed.suggested_medicines
      : fallback.suggestedMedicines || [];

    return {
      score: parsed.urgency_score ?? fallback.score,
      advice: parsed.advice || fallback.advice,
      needsDoctor,
      diagnosis: parsed.diagnosis || fallback.diagnosis || 'Could not determine.',
      suggestedMedicines,
      careInstructions: parsed.care_instructions || fallback.careInstructions || 'Rest and stay hydrated.',
      needsDoctorMsg: needsDoctor
        ? getTranslation(lang, 'triage', 'needsDoctor')
        : getTranslation(lang, 'triage', 'noDoctor'),
    };
  } catch (_) {
    const fallback = triageFallback(symptoms, lang);
    return {
      score: fallback.score,
      advice: fallback.advice,
      needsDoctor: fallback.needsDoctor,
      diagnosis: 'Unable to determine. Please see a doctor.',
      suggestedMedicines: [],
      careInstructions: 'Seek medical help if symptoms worsen.',
      needsDoctorMsg: fallback.needsDoctor
        ? getTranslation(lang, 'triage', 'needsDoctor')
        : getTranslation(lang, 'triage', 'noDoctor'),
    };
  }
}

export function locatorAgent(userLat, userLng) {
  return CLINICS.map((c) => ({
    ...c,
    distance_km: Math.round(haversine(userLat, userLng, c.lat, c.lng) * 10) / 10,
    eta_minutes: Math.round(haversine(userLat, userLng, c.lat, c.lng) * 2),
  })).sort((a, b) => a.distance_km - b.distance_km).slice(0, 4);
}

export function transportAgent(choice, lang = 'en') {
  if (choice === 'ambulance') {
    return {
      type: 'ambulance',
      vehicle_id: 'A101',
      driver: 'Rajendra Singh',
      phone: '+91 98765 43210',
      eta_pickup: Math.floor(Math.random() * 10) + 5,
      eta_destination: Math.floor(Math.random() * 20) + 15,
      status: 'dispatched',
      label: getTranslation(lang, 'transport', 'ambulance'),
    };
  }
  return {
    type: 'volunteer',
    driver: 'Priya Sharma',
    phone: '+91 98765 00000',
    eta_pickup: Math.floor(Math.random() * 15) + 10,
    eta_destination: Math.floor(Math.random() * 20) + 15,
    status: 'matched',
    label: getTranslation(lang, 'transport', 'volunteer'),
  };
}

export function followupAgent(patientId, lang = 'en') {
  return {
    med_reminders: getTranslation(lang, 'followup', 'reminders'),
    visit_check: getTranslation(lang, 'followup', 'visitCheck'),
    instructions: getTranslation(lang, 'followup', 'instructions'),
  };
}

export function createSession(arg1, arg2, arg3) {
  let payload = { symptoms: '', lat: 0, lng: 0, lang: 'en' };
  if (typeof arg1 === 'object' && arg1 !== null) {
    payload = { ...payload, ...arg1 };
  } else {
    payload = { ...payload, lat: Number(arg1) || 0, lng: Number(arg2) || 0, lang: arg3 || 'en' };
  }
  const id = uuidv4();
  const session = {
    id,
    ...payload,
    triage: null,
    clinics: null,
    clinic: null,
    appointment: null,
    transport: null,
    createdAt: Date.now(),
  };
  sessions.set(id, session);
  saveSessionsToDisk();
  return id;
}

export function getSession(id) {
  return sessions.get(id) || null;
}

export function updateSession(id, patch) {
  const current = sessions.get(id);
  if (!current) return null;
  const updated = { ...current, ...patch };
  sessions.set(id, updated);
  saveSessionsToDisk();
  return updated;
}

export function getAllSessionIds() {
  loadSessionsFromDisk();
  return Array.from(sessions.keys());
}

export function getAllSessions() {
  return Array.from(sessions.values());
}

export function bookingAgent(sessionId, clinicId) {
  const session = sessions.get(sessionId);
  if (!session) return { error: 'Session not found' };
  const clinic = session.clinics?.find((c) => String(c.id) === String(clinicId));
  if (!clinic) return { error: 'Clinic not found' };
  const updated = updateSession(sessionId, { clinic, appointment: { time: '2026-07-06 10:00 AM', status: 'confirmed' } });
  return { message: 'Appointment booked. Do you need transport?', appointment: updated?.appointment, clinic };
}

export function trackingAgent(sessionId) {
  const session = sessions.get(sessionId);
  if (!session || !session.transport) return { error: 'No transport' };
  const vehicle_lat = session.clinic ? session.clinic.lat - 0.002 : (session.clinics?.[0]?.lat || 0) - 0.002;
  const vehicle_lng = session.clinic ? session.clinic.lng - 0.002 : (session.clinics?.[0]?.lng || 0) - 0.002;
  return {
    vehicle_lat,
    vehicle_lng,
    eta_pickup: session.transport.eta_pickup,
    eta_destination: Math.max(5, session.transport.eta_destination || session.transport.eta_pickup + 12),
  };
}

export function reportAgent(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return { error: 'Session not found' };
  return {
    symptoms: session.symptoms,
    triage_score: session.triage?.score || 0,
    advice: session.triage?.advice || 'N/A',
    diagnosis: session.triage?.diagnosis || 'N/A',
    suggested_medicines: session.triage?.suggestedMedicines || [],
    care_instructions: session.triage?.careInstructions || 'None provided',
    clinic_visited: session.clinic?.name || null,
    transport_used: session.transport?.label || 'Own',
    followup_instructions: 'Follow up if symptoms persist.',
  };
}

export default { createSession, getSession, updateSession, bookingAgent, transportAgent, trackingAgent, reportAgent };