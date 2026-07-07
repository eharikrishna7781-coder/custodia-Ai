import { getSession } from '@/lib/agents';

export async function GET(request, { params }) {
  try {
    const { session } = params;
    const data = getSession(session);
    if (!data || !data.transport) return Response.json({ error: 'No transport booked' }, { status: 404 });
    const { userLat, userLng, transport } = data;
    const offset = 0.01 * (Math.random() - 0.5);
    return Response.json({
      vehicle_lat: userLat + offset,
      vehicle_lng: userLng + offset,
      eta_pickup: Math.max(0, transport.eta_pickup - 2),
      eta_destination: Math.max(0, transport.eta_destination - 3),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
