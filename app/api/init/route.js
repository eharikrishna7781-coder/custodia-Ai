import { triageAgent, locatorAgent, createSession, updateSession } from '@/lib/agents';

export async function POST(request) {
  try {
    const { symptoms, lat, lng, lang } = await request.json();
    const sessionId = createSession(lat, lng, lang);
    const triage = await triageAgent(symptoms, lang);
    updateSession(sessionId, { triage, symptoms });
    const response = { sessionId, triage, suggestDoctor: triage.needsDoctor, message: triage.needsDoctorMsg };
    if (triage.needsDoctor) {
      const clinics = locatorAgent(lat, lng);
      response.clinics = clinics;
      updateSession(sessionId, { clinics });
    }
    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
