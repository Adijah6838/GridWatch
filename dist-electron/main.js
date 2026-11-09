"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const worker_threads_1 = require("worker_threads");
const connection_1 = require("./database/connection");
const websocketServer_1 = require("./services/websocketServer");
const telemetryService_1 = require("./services/telemetryService");
const anomalyEngine_1 = require("./services/anomalyEngine");
const eventBus_1 = require("./services/eventBus");
const reportService_1 = require("./services/reportService");
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400, height: 900, title: "GridWatch", show: false,
        webPreferences: { preload: path_1.default.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
    });
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        mainWindow?.webContents.openDevTools({ mode: 'detach' });
    });
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://127.0.0.1:5173');
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    (0, connection_1.initDB)();
    createWindow();
    (0, websocketServer_1.startWebSocketServer)(3001);
    (0, eventBus_1.logEvent)('SYSTEM_START', 'GridWatch application started.');
    setInterval(() => {
        try {
            const telemetry = (0, telemetryService_1.generateTelemetry)();
            (0, telemetryService_1.saveTelemetryToDB)(telemetry);
            (0, anomalyEngine_1.detectAnomalies)(telemetry);
            (0, websocketServer_1.broadcastTelemetry)(telemetry);
        }
        catch (error) {
            console.error('Telemetry error:', error);
        }
    }, 3000);
    electron_1.app.on('activate', () => { if (electron_1.BrowserWindow.getAllWindows().length === 0)
        createWindow(); });
});
electron_1.app.on('window-all-closed', () => { if (process.platform !== 'darwin')
    electron_1.app.quit(); });
// --- AUTHENTICATION ---
electron_1.ipcMain.handle('auth:login', (_, { username, password }) => {
    try {
        const db = (0, connection_1.getDB)();
        const user = db.prepare('SELECT * FROM operators WHERE username = ?').get(username);
        if (!user)
            return { success: false, error: 'User not found.' };
        if (user.password_hash !== (0, connection_1.hashPassword)(password))
            return { success: false, error: 'Invalid password.' };
        (0, eventBus_1.logEvent)('USER_LOGIN', `User ${user.name} (${user.role}) logged in.`);
        return { success: true, user: { id: user.id, name: user.name, role: user.role, username: user.username } };
    }
    catch (error) {
        console.error("Login Error:", error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('auth:get-operators', () => {
    return (0, connection_1.getDB)().prepare('SELECT id, username, name, role FROM operators').all();
});
electron_1.ipcMain.handle('auth:add-operator', (_, { username, name, role, password }) => {
    try {
        const hash = (0, connection_1.hashPassword)(password);
        const info = (0, connection_1.getDB)().prepare(`INSERT INTO operators (username, name, role, password_hash) VALUES (?, ?, ?, ?)`).run(username, name, role, hash);
        (0, eventBus_1.logEvent)('USER_CREATED', `New operator account created for ${name} (${role}).`);
        return { success: true, id: info.lastInsertRowid };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// --- STATIONS ---
electron_1.ipcMain.handle('stations:get', () => (0, connection_1.getDB)().prepare('SELECT * FROM stations').all());
electron_1.ipcMain.handle('stations:add', (_, data) => {
    try {
        const info = (0, connection_1.getDB)().prepare(`INSERT INTO stations (id, name, region, equipment_type) VALUES (@id, @name, @region, @equipment_type)`).run(data);
        (0, eventBus_1.logEvent)('STATION_REGISTERED', `Station ${data.name} registered.`);
        return { success: true, id: info.lastInsertRowid };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('stations:update', (_, data) => {
    try {
        (0, connection_1.getDB)().prepare(`UPDATE stations SET name=@name, region=@region, equipment_type=@equipment_type WHERE id=@id`).run(data);
        (0, eventBus_1.logEvent)('STATION_UPDATED', `Station ${data.id} updated.`);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('stations:toggle', (_, { id, status }) => {
    try {
        (0, connection_1.getDB)().prepare(`UPDATE stations SET status = ? WHERE id = ?`).run(status, id);
        (0, eventBus_1.logEvent)('STATION_STATUS_CHANGED', `Station ${id} status set to ${status}.`);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// --- ANOMALIES / ANALYTICS ---
electron_1.ipcMain.handle('anomalies:get', () => (0, connection_1.getDB)().prepare(`SELECT a.*, s.name as station_name FROM anomalies a JOIN stations s ON a.station_id = s.id ORDER BY a.timestamp DESC LIMIT 50`).all());
electron_1.ipcMain.handle('analytics:get', () => {
    const db = (0, connection_1.getDB)();
    const energyStats = db.prepare(`SELECT SUM(energy_generated) as total_generated, SUM(power_consumption) as total_consumed FROM telemetry`).get();
    const tempByStation = db.prepare(`SELECT s.name, AVG(t.temperature) as avg_temp FROM telemetry t JOIN stations s ON t.station_id = s.id GROUP BY s.id`).all();
    return { energyStats, tempByStation };
});
electron_1.ipcMain.handle('operators:get', () => (0, connection_1.getDB)().prepare('SELECT * FROM operators').all());
// --- INCIDENTS ---
electron_1.ipcMain.handle('incidents:get', () => (0, connection_1.getDB)().prepare(`SELECT i.*, s.name as station_name, o.name as operator_name FROM incidents i JOIN stations s ON i.station_id = s.id LEFT JOIN operators o ON i.assigned_operator_id = o.id ORDER BY i.created_at DESC`).all());
electron_1.ipcMain.handle('incidents:create', (_, data) => {
    try {
        const info = (0, connection_1.getDB)().prepare(`INSERT INTO incidents (station_id, title, category, severity, description, assigned_operator_id) VALUES (@station_id, @title, @category, @severity, @description, @assigned_operator_id)`).run(data);
        (0, eventBus_1.logEvent)('INCIDENT_CREATED', `Incident #${info.lastInsertRowid} created.`);
        return { success: true, id: info.lastInsertRowid };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('incidents:update-status', (_, { id, status, resolution_notes }) => {
    try {
        const resolvedAt = status === 'Resolved' || status === 'Closed' ? new Date().toISOString() : null;
        (0, connection_1.getDB)().prepare(`UPDATE incidents SET status = ?, resolution_notes = ?, resolved_at = ? WHERE id = ?`).run(status, resolution_notes || null, resolvedAt, id);
        (0, eventBus_1.logEvent)('INCIDENT_UPDATED', `Incident #${id} updated to ${status}.`);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// --- BACKGROUND JOBS ---
electron_1.ipcMain.handle('jobs:get', () => (0, connection_1.getDB)().prepare('SELECT * FROM background_jobs ORDER BY start_time DESC').all());
electron_1.ipcMain.handle('jobs:start', async () => {
    const db = (0, connection_1.getDB)();
    const startTime = new Date();
    const insert = db.prepare(`INSERT INTO background_jobs (job_type, status, start_time) VALUES ('Analytics Computation', 'Running', ?)`);
    const info = insert.run(startTime.toISOString());
    const jobId = info.lastInsertRowid;
    (0, eventBus_1.logEvent)('JOB_STARTED', `Background Job #${jobId} started.`);
    const workerPath = path_1.default.join(__dirname, 'workers', 'analyticsWorker.js');
    if (!fs_1.default.existsSync(workerPath)) {
        db.prepare(`UPDATE background_jobs SET status = 'Failed', error_message = ? WHERE id = ?`).run('Worker file not found on disk.', jobId);
        return { success: false, error: 'Worker file not found.' };
    }
    return new Promise((resolve) => {
        const worker = new worker_threads_1.Worker(workerPath);
        worker.on('message', () => { const endTime = new Date(); const duration = endTime.getTime() - startTime.getTime(); db.prepare(`UPDATE background_jobs SET status = 'Completed', end_time = ?, duration_ms = ? WHERE id = ?`).run(endTime.toISOString(), duration, jobId); (0, eventBus_1.logEvent)('JOB_COMPLETED', `Background Job #${jobId} completed in ${duration}ms.`); resolve({ success: true, duration }); });
        worker.on('error', (err) => { const endTime = new Date(); const duration = endTime.getTime() - startTime.getTime(); db.prepare(`UPDATE background_jobs SET status = 'Failed', end_time = ?, duration_ms = ?, error_message = ? WHERE id = ?`).run(endTime.toISOString(), duration, err.message, jobId); (0, eventBus_1.logEvent)('JOB_FAILED', `Background Job #${jobId} failed: ${err.message}`); resolve({ success: false, error: err.message }); });
    });
});
electron_1.ipcMain.handle('events:get', () => (0, connection_1.getDB)().prepare('SELECT * FROM system_events ORDER BY created_at DESC LIMIT 100').all());
// --- REPORTS ---
electron_1.ipcMain.handle('reports:export', async (_, type) => {
    return await (0, reportService_1.generateCSVReport)(type);
});
