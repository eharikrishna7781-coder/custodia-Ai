import { transportAgent, getSession, updateSession } from '@/lib/agents';

export async function POST(request) {
  try {
    const { sessionId, choice } = await request.json();
    const session = getSession(sessionId);
    if (!session || !session.clinic) return Response.json({ error: 'No clinic booked' }, { status: 400 });
    const transport = transportAgent(choice, session.lang || 'en');
    updateSession(sessionId, { transport });
    return Response.json(transport);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
