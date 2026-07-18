import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import translations, { getTranslation } from './translations';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const sessions = new Map();
const SESSIONS_DIR = path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(SESSIONS_DIR, 'sessions.json');
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

function ensureDataDir() {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  } catch (err) {
    console.warn('Failed to create data directory:', err.message);
  }
}

function loadSessionsFromDisk() {
  try {
    ensureDataDir();
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
      const obj = JSON.parse(raw || '{}');
      sessions.clear();
      Object.entries(obj).forEach(([k, v]) => {
        // Validate session before loading
        if (v && typeof v === 'object') {
          sessions.set(k, { ...v, id: k });
        }
      });
      console.log(`Loaded ${sessions.size} sessions from disk`);
    }
  } catch (err) {
    console.warn('Failed to load sessions from disk:', err.message);
  }
}

function saveSessionsToDisk() {
  try {
    ensureDataDir();
    const obj = Object.fromEntries(sessions);
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed to save sessions to disk:', err.message);
  }
}

// Load sessions on startup
loadSessionsFromDisk();

// Periodic cleanup of old sessions (older than 24 hours)
setInterval(() => {
  const now = Date.now();
  const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
  let cleaned = 0;
  for (const [id, session] of sessions.entries()) {
    if (session.createdAt && (now - session.createdAt) > MAX_AGE) {
      sessions.delete(id);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} old sessions`);
    saveSessionsToDisk();
  }
}, 60 * 60 * 1000); // Run every hour

// Hyderabad area clinics
const CLINICS = [
  { id: 1, name: 'Primary Health Centre Hyderabad', lat: 17.3850, lng: 78.4867, stock: 80, specialists: 2, phone: '+91 40 6667 1111', address: 'Himayatnagar, Hyderabad' },
  { id: 2, name: 'Community Clinic Secunderabad', lat: 17.3689, lng: 78.5294, stock: 60, specialists: 1, phone: '+91 40 2762 2222', address: 'Secunderabad, Telangana' },
  { id: 3, name: 'Rural Hospital Dilsukhnagar', lat: 17.3412, lng: 78.5167, stock: 90, specialists: 4, phone: '+91 40 6545 3333', address: 'Dilsukhnagar, Hyderabad' },
  { id: 4, name: 'Urban Care Hospital Jubilee Hills', lat: 17.3960, lng: 78.4020, stock: 88, specialists: 5, phone: '+91 40 2355 4444', address: 'Jubilee Hills, Hyderabad' },
  { id: 5, name: 'Govt Health Sub-Centre Kukatpally', lat: 17.4696, lng: 78.4456, stock: 45, specialists: 1, phone: '+91 40 2373 5555', address: 'Kukatpally, Hyderabad' },
];

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Function to clean markdown symbols from text
function cleanMarkdownSymbols(text) {
  if (!text) return text;
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/__/g, '')
    .replace(/`/g, '')
    .replace(/~/g, '')
    .replace(/#+\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .trim();
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') {
    console.warn('GEMINI_API_KEY not configured');
    return null;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return cleanMarkdownSymbols(text);
    } catch (error) {
      console.error(`Gemini API error (attempt ${attempt}/${MAX_RETRIES}):`, error.message);
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
    }
  }
  return null;
}

function extractJsonPayload(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const json = JSON.parse(cleaned.slice(start, end + 1));
      // Clean markdown from all text fields
      if (json.diagnosis) json.diagnosis = cleanMarkdownSymbols(json.diagnosis);
      if (json.advice) json.advice = cleanMarkdownSymbols(json.advice);
      if (json.care_instructions) json.care_instructions = cleanMarkdownSymbols(json.care_instructions);
      if (json.suggested_medicines) {
        json.suggested_medicines = json.suggested_medicines.map(m => ({
          ...m,
          name: cleanMarkdownSymbols(m.name),
          dosage: cleanMarkdownSymbols(m.dosage),
          frequency: cleanMarkdownSymbols(m.frequency),
          timing: cleanMarkdownSymbols(m.timing),
          duration: cleanMarkdownSymbols(m.duration),
        }));
      }
      return json;
    } catch (_) {
      return null;
    }
  }
  try {
    const json = JSON.parse(cleaned);
    // Clean markdown from all text fields
    if (json.diagnosis) json.diagnosis = cleanMarkdownSymbols(json.diagnosis);
    if (json.advice) json.advice = cleanMarkdownSymbols(json.advice);
    if (json.care_instructions) json.care_instructions = cleanMarkdownSymbols(json.care_instructions);
    if (json.suggested_medicines) {
      json.suggested_medicines = json.suggested_medicines.map(m => ({
        ...m,
        name: cleanMarkdownSymbols(m.name),
        dosage: cleanMarkdownSymbols(m.dosage),
        frequency: cleanMarkdownSymbols(m.frequency),
        timing: cleanMarkdownSymbols(m.timing),
        duration: cleanMarkdownSymbols(m.duration),
      }));
    }
    return json;
  } catch (_) {
    return null;
  }
}

function triageFallback(symptoms, lang = 'en') {
  const text = (symptoms || '').toLowerCase();
  const t = translations[lang] || translations.en;

  // Critical conditions
  if (/chest pain|breathing difficulty|cant breathe|unconscious|not responding|severe bleeding|heart attack|cardiac arrest|stroke|seizure|convulsions|anaphylaxis|allergic reaction|poisoning|overdose|trauma|electric shock/.test(text)) {
    return {
      score: 5,
      advice: t.triage.critical,
      needsDoctor: true,
      diagnosis: 'Possible life-threatening emergency requiring immediate medical attention.',
      suggestedMedicines: [],
      careInstructions: 'Call emergency services 108 or 112 immediately. Do not delay. Keep patient calm and still.',
    };
  }

  // High urgency
  if (/high fever|vomiting|severe headache|severe pain|abdominal pain|stomach pain|diarrhea|dehydration|blood in|chest discomfort|shortness of breath/.test(text)) {
    return {
      score: 4,
      advice: t.triage.high,
      needsDoctor: true,
      diagnosis: 'Possible infection or acute condition requiring medical evaluation.',
      suggestedMedicines: [
        { name: 'Paracetamol Dolo 650', dosage: '1 tablet', type: 'OTC', frequency: 'every 6 hours if needed', duration: '2-3 days', timing: 'after food' },
        { name: 'Oral Rehydration Salts ORS', dosage: '1 packet in 1 liter water', type: 'OTC', frequency: 'sip throughout day', duration: '1-2 days', timing: 'as needed' },
      ],
      careInstructions: 'Rest, drink plenty of fluids, and see a doctor within 24 hours. Seek emergency care if symptoms worsen.',
    };
  }

  // Medium
  if (/fever|cough|cold|sore throat|headache|body ache|body pain|weakness|tired|fatigue/.test(text)) {
    return {
      score: 3,
      advice: t.triage.medium,
      needsDoctor: false,
      diagnosis: 'Likely viral fever, common cold, or flu-like illness.',
      suggestedMedicines: [
        { name: 'Paracetamol Dolo 650', dosage: '1 tablet', type: 'OTC', frequency: 'every 6 hours if needed', duration: '2-3 days', timing: 'after food' },
        { name: 'Cetirizine', dosage: '1 tablet', type: 'OTC', frequency: 'once daily at night', duration: '3 days', timing: 'before bed' },
        { name: 'Vitamin C', dosage: '500mg', type: 'OTC', frequency: 'once daily', duration: '7 days', timing: 'after breakfast' },
      ],
      careInstructions: 'Rest, stay hydrated with warm fluids, and monitor temperature. Consult doctor if fever persists beyond 3 days or symptoms worsen.',
    };
  }

  // Low - skin issues
  if (/rash|skin|itch|allergy|hives|red spots/.test(text)) {
    return {
      score: 2,
      advice: t.triage.low,
      needsDoctor: false,
      diagnosis: 'Possible mild allergy, skin irritation, or heat rash.',
      suggestedMedicines: [
        { name: 'Cetirizine', dosage: '1 tablet', type: 'OTC', frequency: 'once daily at night', duration: '3 days', timing: 'before bed' },
        { name: 'Calamine lotion', dosage: 'apply thin layer', type: 'OTC', frequency: '2-3 times daily', duration: 'as needed', timing: 'as needed' },
      ],
      careInstructions: 'Avoid scratching, keep area clean and dry. Seek care if rash spreads, develops pus, or is accompanied by fever.',
    };
  }

  // Low - general
  return {
    score: 2,
    advice: t.triage.low,
    needsDoctor: false,
    diagnosis: 'Possible mild condition that can often be managed with rest and home care.',
    suggestedMedicines: [
      { name: 'Paracetamol Dolo 650', dosage: '1 tablet', type: 'OTC', frequency: 'every 6 hours if needed', duration: '1-2 days', timing: 'after food' },
    ],
    careInstructions: 'Rest, drink plenty of fluids, eat light meals. Seek medical help if symptoms worsen or persist beyond 2-3 days.',
  };
}

export async function triageAgent(symptoms, lang = 'en') {
  const backendUrl = process.env.INTERNAL_BACKEND_URL || 'http://localhost:8001';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const resp = await fetch(`${backendUrl}/api/triage-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symptoms, lang }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      console.warn('Triage AI backend returned', resp.status);
      throw new Error(`AI backend ${resp.status}`);
    }

    const parsed = await resp.json();
    const fallback = triageFallback(symptoms, lang);

    const needsDoctor = parsed.needs_doctor ?? fallback.needsDoctor;
    const suggestedMedicines = Array.isArray(parsed.suggested_medicines) && parsed.suggested_medicines.length > 0
      ? parsed.suggested_medicines
      : fallback.suggestedMedicines || [];

    return {
      score: parsed.urgency_score ?? fallback.score,
      advice: cleanMarkdownSymbols(parsed.advice || fallback.advice),
      needsDoctor,
      diagnosis: cleanMarkdownSymbols(parsed.diagnosis || fallback.diagnosis || 'Could not determine.'),
      suggestedMedicines,
      careInstructions: cleanMarkdownSymbols(parsed.care_instructions || fallback.careInstructions || 'Rest and stay hydrated.'),
      needsDoctorMsg: needsDoctor
        ? getTranslation(lang, 'triage', 'needsDoctor')
        : getTranslation(lang, 'triage', 'noDoctor'),
      aiGenerated: true,
    };
  } catch (err) {
    console.warn('triageAgent AI call failed, using fallback:', err.message);
    const fallback = triageFallback(symptoms, lang);
    return {
      score: fallback.score,
      advice: fallback.advice,
      needsDoctor: fallback.needsDoctor,
      diagnosis: fallback.diagnosis || 'Unable to determine. Please see a doctor.',
      suggestedMedicines: fallback.suggestedMedicines || [],
      careInstructions: fallback.careInstructions || 'Seek medical help if symptoms worsen.',
      needsDoctorMsg: fallback.needsDoctor
        ? getTranslation(lang, 'triage', 'needsDoctor')
        : getTranslation(lang, 'triage', 'noDoctor'),
      aiGenerated: false,
    };
  }
}

export function locatorAgent(userLat, userLng) {
  if (!userLat || !userLng || isNaN(userLat) || isNaN(userLng)) {
    console.warn('Invalid coordinates provided to locatorAgent');
    return CLINICS.map(c => ({ ...c, distance_km: 'unknown', eta_minutes: 'unknown' }));
  }

  return CLINICS.map((c) => ({
    ...c,
    distance_km: Math.round(haversine(userLat, userLng, c.lat, c.lng) * 10) / 10,
    eta_minutes: Math.round(haversine(userLat, userLng, c.lat, c.lng) * 3),
  }))
  .sort((a, b) => (a.distance_km === 'unknown' ? 1 : b.distance_km === 'unknown' ? -1 : a.distance_km - b.distance_km))
  .slice(0, 5);
}

export function transportAgent(choice, lang = 'en') {
  const now = new Date();
  const estimatedPickup = Math.floor(Math.random() * 10) + 5;

  if (choice === 'ambulance') {
    const drivers = [
      { name: 'Rajendra Singh', phone: '+91 98765 43210', vehicle: 'TS29 AB 1234' },
      { name: 'Mohan Kumar', phone: '+91 98765 43211', vehicle: 'TS29 AB 1235' },
      { name: 'Suresh Reddy', phone: '+91 98765 43212', vehicle: 'TS29 AB 1236' },
    ];
    const driver = drivers[Math.floor(Math.random() * drivers.length)];
    return {
      type: 'ambulance',
      vehicle_id: driver.vehicle,
      driver: driver.name,
      phone: driver.phone,
      eta_pickup: estimatedPickup,
      eta_destination: estimatedPickup + Math.floor(Math.random() * 15) + 10,
      status: 'dispatched',
      label: getTranslation(lang, 'transport', 'ambulance'),
      dispatch_time: now.toISOString(),
    };
  }

  // Volunteer driver
  const drivers = [
    { name: 'Priya Sharma', phone: '+91 98765 00001', vehicle: 'White Swift' },
    { name: 'Amit Patel', phone: '+91 98765 00002', vehicle: 'Blue WagonR' },
    { name: 'Lakshmi Devi', phone: '+91 98765 00003', vehicle: 'Red Alto' },
  ];
  const driver = drivers[Math.floor(Math.random() * drivers.length)];
  return {
    type: 'volunteer',
    driver: driver.name,
    phone: driver.phone,
    vehicle: driver.vehicle,
    eta_pickup: estimatedPickup + 5,
    eta_destination: estimatedPickup + Math.floor(Math.random() * 20) + 15,
    status: 'matched',
    label: getTranslation(lang, 'transport', 'volunteer'),
    dispatch_time: now.toISOString(),
  };
}

export function followupAgent(patientId, lang = 'en') {
  return {
    med_reminders: getTranslation(lang, 'followup', 'reminders'),
    visit_check: getTranslation(lang, 'followup', 'visitCheck'),
    instructions: getTranslation(lang, 'followup', 'instructions'),
    checkin_schedule: '24 hours, 72 hours, 1 week',
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
    lastActivity: Date.now(),
  };
  sessions.set(id, session);
  saveSessionsToDisk();
  return id;
}

export function getSession(id) {
  if (!id) return null;
  const session = sessions.get(id);
  if (session) {
    session.lastActivity = Date.now();
  }
  return session || null;
}

export function updateSession(id, patch) {
  if (!id) return null;
  const current = sessions.get(id);
  if (!current) return null;
  const updated = {
    ...current,
    ...patch,
    lastActivity: Date.now(),
  };
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

  const appointmentTime = new Date();
  appointmentTime.setHours(appointmentTime.getHours() + 2);
  const timeString = appointmentTime.toLocaleString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const updated = updateSession(sessionId, {
    clinic,
    appointment: {
      time: timeString,
      status: 'confirmed',
      clinic_name: clinic.name,
      clinic_phone: clinic.phone,
      clinic_address: clinic.address,
    }
  });

  return {
    message: `Appointment confirmed at ${clinic.name} for ${timeString}`,
    appointment: updated?.appointment,
    clinic,
  };
}

export function trackingAgent(sessionId) {
  const session = sessions.get(sessionId);
  if (!session || !session.transport) return { error: 'No transport booked' };

  const elapsed = Date.now() - (session.transport.dispatch_time ? new Date(session.transport.dispatch_time).getTime() : Date.now());
  const elapsedMinutes = Math.floor(elapsed / 60000);

  const basePickup = session.transport.eta_pickup || 10;
  const baseDestination = session.transport.eta_destination || 20;

  // Simulate vehicle movement - FIX: Use session coordinates instead of undefined userLocation
  const progress = Math.min(elapsedMinutes / basePickup, 1);
  const clinicOffset = session.clinic
    ? { lat: session.clinic.lat - session.lat, lng: session.clinic.lng - session.lng }
    : { lat: 0.01, lng: 0.01 };

  return {
    vehicle_lat: (session.lat || 17.3850) + (clinicOffset.lat * progress),
    vehicle_lng: (session.lng || 78.4867) + (clinicOffset.lng * progress),
    eta_pickup: Math.max(1, basePickup - elapsedMinutes),
    eta_destination: Math.max(5, baseDestination - elapsedMinutes),
    progress: Math.round(progress * 100),
    status: progress >= 1 ? 'arrived' : 'en_route',
    driver_name: session.transport.driver,
    driver_phone: session.transport.phone,
  };
}

export function reportAgent(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return { error: 'Session not found' };

  const followup = followupAgent(sessionId, session.lang || 'en');

  return {
    patient_id: session.id,
    symptoms: session.symptoms || 'Not recorded',
    triage_score: session.triage?.score || 0,
    advice: session.triage?.advice || 'Not available',
    diagnosis: session.triage?.diagnosis || 'Not available',
    suggested_medicines: session.triage?.suggestedMedicines || [],
    care_instructions: session.triage?.careInstructions || 'None provided',
    clinic_visited: session.clinic?.name || null,
    clinic_address: session.clinic?.address || null,
    clinic_phone: session.clinic?.phone || null,
    transport_used: session.transport?.label || 'Own',
    transport_driver: session.transport?.driver || null,
    transport_phone: session.transport?.phone || null,
    appointment_time: session.appointment?.time || null,
    followup_instructions: followup.instructions,
    followup_checkins: followup.checkin_schedule,
    generated_at: new Date().toISOString(),
    session_duration: session.lastActivity && session.createdAt
      ? Math.round((session.lastActivity - session.createdAt) / 60000) + ' minutes'
      : 'Not available',
  };
}

export default {
  createSession,
  getSession,
  updateSession,
  bookingAgent,
  transportAgent,
  trackingAgent,
  reportAgent,
  triageAgent,
  locatorAgent,
  followupAgent,
};
