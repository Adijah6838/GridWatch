"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.initDB = initDB;
exports.getDB = getDB;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const crypto_1 = __importDefault(require("crypto"));
let db;
// Helper to hash passwords
function hashPassword(password) {
    return crypto_1.default.createHash('sha256').update(password).digest('hex');
}
function initDB() {
    const dbPath = path_1.default.join(electron_1.app.getPath('userData'), 'gridwatch.db');
    db = new better_sqlite3_1.default(dbPath);
    db.pragma('foreign_keys = ON');
    db.exec(`
    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, region TEXT NOT NULL,
      equipment_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Active',
      last_comm_timestamp DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT, station_id INTEGER NOT NULL,
      voltage REAL NOT NULL, current REAL NOT NULL, temperature REAL NOT NULL,
      power_consumption REAL NOT NULL, energy_generated REAL NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT, station_id INTEGER NOT NULL, category TEXT NOT NULL,
      severity TEXT NOT NULL, detected_value REAL NOT NULL, expected_range TEXT NOT NULL,
      description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Unresolved',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT, station_id INTEGER NOT NULL, title TEXT NOT NULL,
      category TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Open',
      assigned_operator_id INTEGER, description TEXT, resolution_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, resolved_at DATETIME,
      FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_operator_id) REFERENCES operators(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS background_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, job_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Running',
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP, end_time DATETIME, duration_ms INTEGER, error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS system_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, description TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_telemetry_station_time ON telemetry(station_id, timestamp);
  `);
    // Seeding logic
    const stationCount = db.prepare('SELECT count(*) as count FROM stations').get();
    if (stationCount.count === 0) {
        const insert = db.prepare(`INSERT INTO stations (id, name, region, equipment_type, status) VALUES (?, ?, ?, 'Smart Meter', 'Active')`);
        const regions = ['North', 'South', 'East', 'West', 'Central'];
        for (let i = 1; i <= 10; i++)
            insert.run(i, `Station ${i}`, regions[i % 5]);
    }
    const opCount = db.prepare('SELECT count(*) as count FROM operators').get();
    if (opCount.count === 0) {
        const insertOp = db.prepare(`INSERT INTO operators (username, name, role, password_hash) VALUES (?, ?, ?, ?)`);
        // Default password for all seeded users is "password123"
        const defaultHash = hashPassword('password123');
        insertOp.run('admin', 'Alice Smith', 'Administrator', defaultHash);
        insertOp.run('operator', 'Bob Jones', 'Monitoring Operator', defaultHash);
        insertOp.run('analyst', 'Charlie Brown', 'Analyst', defaultHash);
    }
    return db;
}
function getDB() {
    if (!db)
        throw new Error("Database not initialized");
    return db;
}
