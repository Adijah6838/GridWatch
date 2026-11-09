"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    login: (data) => electron_1.ipcRenderer.invoke('auth:login', data),
    getAuthOperators: () => electron_1.ipcRenderer.invoke('auth:get-operators'),
    addAuthOperator: (data) => electron_1.ipcRenderer.invoke('auth:add-operator', data),
    getStations: () => electron_1.ipcRenderer.invoke('stations:get'),
    getAnomalies: () => electron_1.ipcRenderer.invoke('anomalies:get'),
    getAnalytics: () => electron_1.ipcRenderer.invoke('analytics:get'),
    getOperators: () => electron_1.ipcRenderer.invoke('operators:get'),
    getIncidents: () => electron_1.ipcRenderer.invoke('incidents:get'),
    createIncident: (data) => electron_1.ipcRenderer.invoke('incidents:create', data),
    updateIncidentStatus: (data) => electron_1.ipcRenderer.invoke('incidents:update-status', data),
    addStation: (data) => electron_1.ipcRenderer.invoke('stations:add', data),
    updateStation: (data) => electron_1.ipcRenderer.invoke('stations:update', data),
    toggleStation: (data) => electron_1.ipcRenderer.invoke('stations:toggle', data),
    getJobs: () => electron_1.ipcRenderer.invoke('jobs:get'),
    startJob: () => electron_1.ipcRenderer.invoke('jobs:start'),
    getEvents: () => electron_1.ipcRenderer.invoke('events:get'),
    exportReport: (type) => electron_1.ipcRenderer.invoke('reports:export', type)
});
