"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logEvent = logEvent;
const connection_1 = require("../database/connection");
function logEvent(eventType, description) {
    const db = (0, connection_1.getDB)();
    try {
        db.prepare(`INSERT INTO system_events (event_type, description) VALUES (?, ?)`).run(eventType, description);
    }
    catch (error) {
        console.error('Failed to log event:', error);
    }
}
