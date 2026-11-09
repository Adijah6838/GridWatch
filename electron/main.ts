import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { Worker } from 'worker_threads'
import { initDB, getDB, hashPassword } from './database/connection'
import { startWebSocketServer, broadcastTelemetry } from './services/websocketServer'
import { generateTelemetry, saveTelemetryToDB } from './services/telemetryService'
import { detectAnomalies } from './services/anomalyEngine'
import { logEvent } from './services/eventBus'
import { generateCSVReport } from './services/reportService'

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, title: "GridWatch", show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  })

  mainWindow.once('ready-to-show', () => { 
    mainWindow?.show(); 
    mainWindow?.webContents.openDevTools({ mode: 'detach' }) 
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://127.0.0.1:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  initDB()
  createWindow()
  startWebSocketServer(3001)
  logEvent('SYSTEM_START', 'GridWatch application started.');

  setInterval(() => {
    try {
      const telemetry = generateTelemetry()
      saveTelemetryToDB(telemetry)
      detectAnomalies(telemetry)
      broadcastTelemetry(telemetry)
    } catch (error) { console.error('Telemetry error:', error) }
  }, 3000)

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// --- AUTHENTICATION ---
ipcMain.handle('auth:login', (_, { username, password }) => {
  try {
    const db = getDB();
    const user = db.prepare('SELECT * FROM operators WHERE username = ?').get(username) as any;
    if (!user) return { success: false, error: 'User not found.' };
    if (user.password_hash !== hashPassword(password)) return { success: false, error: 'Invalid password.' };
    
    logEvent('USER_LOGIN', `User ${user.name} (${user.role}) logged in.`);
    return { success: true, user: { id: user.id, name: user.name, role: user.role, username: user.username } };
  } catch (error: any) {
    console.error("Login Error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('auth:get-operators', () => {
  return getDB().prepare('SELECT id, username, name, role FROM operators').all();
});

ipcMain.handle('auth:add-operator', (_, { username, name, role, password }) => {
  try {
    const hash = hashPassword(password);
    const info = getDB().prepare(`INSERT INTO operators (username, name, role, password_hash) VALUES (?, ?, ?, ?)`).run(username, name, role, hash);
    logEvent('USER_CREATED', `New operator account created for ${name} (${role}).`);
    return { success: true, id: info.lastInsertRowid };
  } catch (error: any) { return { success: false, error: error.message }; }
});

// --- STATIONS ---
ipcMain.handle('stations:get', () => getDB().prepare('SELECT * FROM stations').all());
ipcMain.handle('stations:add', (_, data) => {
  try { const info = getDB().prepare(`INSERT INTO stations (id, name, region, equipment_type) VALUES (@id, @name, @region, @equipment_type)`).run(data); logEvent('STATION_REGISTERED', `Station ${data.name} registered.`); return { success: true, id: info.lastInsertRowid }; } catch (error: any) { return { success: false, error: error.message }; }
});
ipcMain.handle('stations:update', (_, data) => {
  try { getDB().prepare(`UPDATE stations SET name=@name, region=@region, equipment_type=@equipment_type WHERE id=@id`).run(data); logEvent('STATION_UPDATED', `Station ${data.id} updated.`); return { success: true }; } catch (error: any) { return { success: false, error: error.message }; }
});
ipcMain.handle('stations:toggle', (_, { id, status }) => {
  try { getDB().prepare(`UPDATE stations SET status = ? WHERE id = ?`).run(status, id); logEvent('STATION_STATUS_CHANGED', `Station ${id} status set to ${status}.`); return { success: true }; } catch (error: any) { return { success: false, error: error.message }; }
});

// --- ANOMALIES / ANALYTICS ---
ipcMain.handle('anomalies:get', () => getDB().prepare(`SELECT a.*, s.name as station_name FROM anomalies a JOIN stations s ON a.station_id = s.id ORDER BY a.timestamp DESC LIMIT 50`).all());
ipcMain.handle('analytics:get', () => {
  const db = getDB();
  const energyStats = db.prepare(`SELECT SUM(energy_generated) as total_generated, SUM(power_consumption) as total_consumed FROM telemetry`).get() as any;
  const tempByStation = db.prepare(`SELECT s.name, AVG(t.temperature) as avg_temp FROM telemetry t JOIN stations s ON t.station_id = s.id GROUP BY s.id`).all();
  return { energyStats, tempByStation };
});
ipcMain.handle('operators:get', () => getDB().prepare('SELECT * FROM operators').all());

// --- INCIDENTS ---
ipcMain.handle('incidents:get', () => getDB().prepare(`SELECT i.*, s.name as station_name, o.name as operator_name FROM incidents i JOIN stations s ON i.station_id = s.id LEFT JOIN operators o ON i.assigned_operator_id = o.id ORDER BY i.created_at DESC`).all());
ipcMain.handle('incidents:create', (_, data) => {
  try { const info = getDB().prepare(`INSERT INTO incidents (station_id, title, category, severity, description, assigned_operator_id) VALUES (@station_id, @title, @category, @severity, @description, @assigned_operator_id)`).run(data); logEvent('INCIDENT_CREATED', `Incident #${info.lastInsertRowid} created.`); return { success: true, id: info.lastInsertRowid }; } catch (error: any) { return { success: false, error: error.message }; }
});
ipcMain.handle('incidents:update-status', (_, { id, status, resolution_notes }) => {
  try { const resolvedAt = status === 'Resolved' || status === 'Closed' ? new Date().toISOString() : null; getDB().prepare(`UPDATE incidents SET status = ?, resolution_notes = ?, resolved_at = ? WHERE id = ?`).run(status, resolution_notes || null, resolvedAt, id); logEvent('INCIDENT_UPDATED', `Incident #${id} updated to ${status}.`); return { success: true }; } catch (error: any) { return { success: false, error: error.message }; }
});

// --- BACKGROUND JOBS ---
ipcMain.handle('jobs:get', () => getDB().prepare('SELECT * FROM background_jobs ORDER BY start_time DESC').all());
ipcMain.handle('jobs:start', async () => {
  const db = getDB(); const startTime = new Date();
  const insert = db.prepare(`INSERT INTO background_jobs (job_type, status, start_time) VALUES ('Analytics Computation', 'Running', ?)`);
  const info = insert.run(startTime.toISOString()); const jobId = info.lastInsertRowid;
  logEvent('JOB_STARTED', `Background Job #${jobId} started.`);
  const workerPath = path.join(__dirname, 'workers', 'analyticsWorker.js');
  if (!fs.existsSync(workerPath)) { db.prepare(`UPDATE background_jobs SET status = 'Failed', error_message = ? WHERE id = ?`).run('Worker file not found on disk.', jobId); return { success: false, error: 'Worker file not found.' }; }
  return new Promise((resolve) => {
    const worker = new Worker(workerPath);
    worker.on('message', () => { const endTime = new Date(); const duration = endTime.getTime() - startTime.getTime(); db.prepare(`UPDATE background_jobs SET status = 'Completed', end_time = ?, duration_ms = ? WHERE id = ?`).run(endTime.toISOString(), duration, jobId); logEvent('JOB_COMPLETED', `Background Job #${jobId} completed in ${duration}ms.`); resolve({ success: true, duration }); });
    worker.on('error', (err) => { const endTime = new Date(); const duration = endTime.getTime() - startTime.getTime(); db.prepare(`UPDATE background_jobs SET status = 'Failed', end_time = ?, duration_ms = ?, error_message = ? WHERE id = ?`).run(endTime.toISOString(), duration, err.message, jobId); logEvent('JOB_FAILED', `Background Job #${jobId} failed: ${err.message}`); resolve({ success: false, error: err.message }); });
  });
});

ipcMain.handle('events:get', () => getDB().prepare('SELECT * FROM system_events ORDER BY created_at DESC LIMIT 100').all());

// --- REPORTS ---
ipcMain.handle('reports:export', async (_, type) => {
  return await generateCSVReport(type);
});
