import { getAllSessions } from '@/lib/agents';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const inMemory = getAllSessions();
    const SESSIONS_DIR = path.join(process.cwd(), 'data');
    const SESSIONS_FILE = path.join(SESSIONS_DIR, 'sessions.json');
    let persisted = null;
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        persisted = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8') || '{}');
      }
    } catch (e) {
      persisted = { error: 'could not read persisted file', detail: String(e) };
    }
    return new Response(JSON.stringify({ inMemory, persisted }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'failed', detail: String(err) }), { status: 500 });
  }
}
