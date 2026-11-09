import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  login: (data: any) => ipcRenderer.invoke('auth:login', data),
  getAuthOperators: () => ipcRenderer.invoke('auth:get-operators'),
  addAuthOperator: (data: any) => ipcRenderer.invoke('auth:add-operator', data),
  getStations: () => ipcRenderer.invoke('stations:get'),
  getAnomalies: () => ipcRenderer.invoke('anomalies:get'),
  getAnalytics: () => ipcRenderer.invoke('analytics:get'),
  getOperators: () => ipcRenderer.invoke('operators:get'),
  getIncidents: () => ipcRenderer.invoke('incidents:get'),
  createIncident: (data: any) => ipcRenderer.invoke('incidents:create', data),
  updateIncidentStatus: (data: any) => ipcRenderer.invoke('incidents:update-status', data),
  addStation: (data: any) => ipcRenderer.invoke('stations:add', data),
  updateStation: (data: any) => ipcRenderer.invoke('stations:update', data),
  toggleStation: (data: any) => ipcRenderer.invoke('stations:toggle', data),
  getJobs: () => ipcRenderer.invoke('jobs:get'),
  startJob: () => ipcRenderer.invoke('jobs:start'),
  getEvents: () => ipcRenderer.invoke('events:get'),
  exportReport: (type: string) => ipcRenderer.invoke('reports:export', type)
})
