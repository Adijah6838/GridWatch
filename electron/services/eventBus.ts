import { getDB } from '../database/connection';

export function logEvent(eventType: string, description: string) {
  const db = getDB();
  try {
    db.prepare(`INSERT INTO system_events (event_type, description) VALUES (?, ?)`).run(eventType, description);
  } catch (error) {
    console.error('Failed to log event:', error);
  }
}
