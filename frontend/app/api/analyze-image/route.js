import { analyzeImage } from '@/lib/visualAnalysis';

export async function POST(request) {
  try {
    const body = await request.json();
    const { image } = body;
    const res = await analyzeImage(image);
    return new Response(JSON.stringify(res), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Analysis failed' }), { status: 400 });
  }
}
