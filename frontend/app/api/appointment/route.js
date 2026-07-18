import { getSession, updateSession } from '@/lib/agents';

export async function POST(request) {
  try {
    const { sessionId, clinicId } = await request.json();
    const session = getSession(sessionId);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });
    const clinic = session.clinics?.find((c) => String(c.id) === String(clinicId));
    if (!clinic) return Response.json({ error: 'Clinic not found' }, { status: 404 });
    const updated = updateSession(sessionId, { clinic, appointment: { time: '2026-07-06 10:00 AM', status: 'confirmed' } });
    return Response.json({
      appointment: updated?.appointment,
      message: 'Appointment booked. Do you need transport?',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
