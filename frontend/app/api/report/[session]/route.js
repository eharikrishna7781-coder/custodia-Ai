import { followupAgent, getSession } from '@/lib/agents';

export async function GET(request, { params }) {
  try {
    const { session } = params;
    const data = getSession(session);
    if (!data) return Response.json({ error: 'Session not found' }, { status: 404 });
    const lang = data.lang || 'en';
    const followup = followupAgent(session, lang);
    const report = {
      patient_id: session,
      symptoms: data.symptoms || 'Not recorded',
      triage_score: data.triage?.score || 0,
      advice: data.triage?.advice || 'N/A',
      diagnosis: data.triage?.diagnosis || 'N/A',
      suggested_medicines: data.triage?.suggestedMedicines || [],
      care_instructions: data.triage?.careInstructions || 'None provided',
      clinic_visited: data.clinic?.name || 'None',
      transport_used: data.transport?.label || 'Own',
      followup_instructions: followup.instructions,
      generated_at: new Date().toISOString(),
    };
    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
