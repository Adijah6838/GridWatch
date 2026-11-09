"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCSVReport = generateCSVReport;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const connection_1 = require("../database/connection");
const eventBus_1 = require("./eventBus");
async function generateCSVReport(type) {
    const db = (0, connection_1.getDB)();
    let data = [];
    let headers = [];
    let defaultFilename = '';
    if (type === 'incidents') {
        data = db.prepare(`SELECT i.id, s.name as station, i.title, i.category, i.severity, i.status, o.name as assigned_to, i.created_at FROM incidents i JOIN stations s ON i.station_id = s.id LEFT JOIN operators o ON i.assigned_operator_id = o.id`).all();
        headers = ['id', 'station', 'title', 'category', 'severity', 'status', 'assigned_to', 'created_at'];
        defaultFilename = 'gridwatch-incidents.csv';
    }
    else if (type === 'telemetry') {
        data = db.prepare(`SELECT t.id, s.name as station, t.voltage, t.current, t.temperature, t.power_consumption, t.energy_generated, t.timestamp FROM telemetry t JOIN stations s ON t.station_id = s.id ORDER BY t.timestamp DESC LIMIT 1000`).all();
        headers = ['id', 'station', 'voltage', 'current', 'temperature', 'power_consumption', 'energy_generated', 'timestamp'];
        defaultFilename = 'gridwatch-telemetry.csv';
    }
    else if (type === 'events') {
        data = db.prepare(`SELECT id, event_type, description, created_at FROM system_events ORDER BY created_at DESC`).all();
        headers = ['id', 'event_type', 'description', 'created_at'];
        defaultFilename = 'gridwatch-events.csv';
    }
    else if (type === 'operators') {
        data = db.prepare(`SELECT id, username, name, role FROM operators`).all();
        headers = ['id', 'username', 'name', 'role'];
        defaultFilename = 'gridwatch-operators.csv';
    }
    if (data.length === 0)
        return { success: false, message: 'No data available to export.' };
    const { canceled, filePath } = await electron_1.dialog.showSaveDialog({
        title: 'Save Report',
        defaultPath: defaultFilename,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });
    if (canceled || !filePath)
        return { success: false, message: 'Export cancelled.' };
    try {
        const escape = (val) => {
            const str = String(val ?? '');
            return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
        };
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(h => escape(row[h])).join(','))
        ].join('\n');
        fs_1.default.writeFileSync(filePath, csvContent, 'utf-8');
        (0, eventBus_1.logEvent)('REPORT_GENERATED', `${type} report exported to CSV.`);
        return { success: true, message: `Report saved to ${filePath}` };
    }
    catch (err) {
        return { success: false, message: `Failed to save: ${err.message}` };
    }
}
