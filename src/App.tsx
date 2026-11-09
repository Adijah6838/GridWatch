import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

interface Station { id: number; name: string; region: string; equipment_type: string; status: string; }
interface Telemetry { station_id: number; station_name: string; region: string; voltage: number; current: number; temperature: number; power_consumption: number; }
interface Anomaly { id: number; station_name: string; category: string; severity: string; detected_value: number; description: string; timestamp: string; }
interface Incident { id: number; station_name: string; title: string; category: string; severity: string; status: string; operator_name: string; created_at: string; resolution_notes: string; }
interface Job { id: number; job_type: string; status: string; start_time: string; end_time: string; duration_ms: number; error_message: string; }
interface SystemEvent { id: number; event_type: string; description: string; created_at: string; }
interface Operator { id: number; username: string; name: string; role: string; }

function App() {
  // Auth State
  const [currentUser, setCurrentUser] = useState<Operator | null>(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // App State
  const [activeTab, setActiveTab] = useState<'command' | 'live' | 'stations' | 'anomalies' | 'incidents' | 'alerts' | 'analytics' | 'jobs' | 'events' | 'operators' | 'reports' | 'settings'>('command');
  const [stations, setStations] = useState<Station[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [latestReadings, setLatestReadings] = useState<Record<number, Telemetry>>({});
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [chartData, setChartData] = useState<any>({ labels: [], datasets: [] });
  const [isConnected, setIsConnected] = useState(false);
  const [analytics, setAnalytics] = useState<any>({ energyStats: {}, tempByStation: [] });
  const [isJobRunning, setIsJobRunning] = useState(false);

  // Forms
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ station_id: '', title: '', category: 'Voltage', severity: 'Warning', description: '', assigned_operator_id: '' });
  const [showStationForm, setShowStationForm] = useState(false);
  const [stationForm, setStationForm] = useState({ id: '', name: '', region: '', equipment_type: 'Smart Meter' });
  
  const [showOperatorForm, setShowOperatorForm] = useState(false);
  const [operatorForm, setOperatorForm] = useState({ username: '', name: '', role: 'Monitoring Operator', password: '' });

  const loadData = () => {
    if ((window as any).api) {
      (window as any).api.getStations().then((data: Station[]) => setStations(data));
      (window as any).api.getAnomalies().then((data: Anomaly[]) => setAnomalies(data));
      (window as any).api.getAnalytics().then((data: any) => setAnalytics(data));
      (window as any).api.getIncidents().then((data: Incident[]) => setIncidents(data));
      (window as any).api.getJobs().then((data: Job[]) => setJobs(data));
      (window as any).api.getEvents().then((data: SystemEvent[]) => setEvents(data));
      
      if (currentUser?.role === 'Administrator') {
        (window as any).api.getAuthOperators().then((data: Operator[]) => setOperators(data));
      }
    }
  };

  useEffect(() => {
    if (!currentUser) return; 

    loadData();
    const newSocket = io('http://127.0.0.1:3001');
    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));
    newSocket.on('telemetry', (data: Telemetry[]) => {
      const newReadings = { ...latestReadings };
      data.forEach(reading => { newReadings[reading.station_id] = reading; });
      setLatestReadings(newReadings);
      if ((window as any).api) {
        (window as any).api.getAnomalies().then((a: Anomaly[]) => setAnomalies(a));
        (window as any).api.getAnalytics().then((data: any) => setAnalytics(data));
      }
      setChartData((prevData: any) => {
        const timeLabel = new Date().toLocaleTimeString();
        const station1 = data.find(d => d.station_id === 1);
        const newLabels = [...prevData.labels, timeLabel].slice(-20);
        const newData = [...(prevData.datasets[0]?.data || []), station1 ? station1.voltage : 0].slice(-20);
        return { labels: newLabels, datasets: [{ label: 'Voltage (Station 1)', data: newData, borderColor: '#4caf50', backgroundColor: 'rgba(76, 175, 80, 0.2)', fill: true, tension: 0.4 }] };
      });
    });
    return () => { newSocket.disconnect(); };
  }, [currentUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!(window as any).api) {
      setLoginError('Backend not connected. Please restart the app.');
      return;
    }
    try {
      const res = await (window as any).api.login(loginData);
      if (res.success) {
        setCurrentUser(res.user);
      } else {
        setLoginError(res.error);
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      setLoginError('An unexpected error occurred. Check the console.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginData({ username: '', password: '' });
    setActiveTab('command');
  };

  const handleStartJob = async () => {
    setIsJobRunning(true);
    if ((window as any).api) {
      await (window as any).api.startJob();
      loadData();
      setIsJobRunning(false);
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(window as any).api) return;
    const payload = { ...incidentForm, station_id: parseInt(incidentForm.station_id), assigned_operator_id: incidentForm.assigned_operator_id ? parseInt(incidentForm.assigned_operator_id) : null };
    const res = await (window as any).api.createIncident(payload);
    if (res.success) { setShowIncidentForm(false); setIncidentForm({ station_id: '', title: '', category: 'Voltage', severity: 'Warning', description: '', assigned_operator_id: '' }); loadData(); } else alert("Error: " + res.error);
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    let notes = ""; if (status === 'Resolved' || status === 'Closed') notes = prompt("Enter resolution notes:") || "Resolved by operator.";
    const res = await (window as any).api.updateIncidentStatus({ id, status, resolution_notes: notes }); if (res.success) loadData();
  };

  const handleSaveStation = async (e: React.FormEvent) => {
    e.preventDefault(); if (!(window as any).api) return;
    const payload = { ...stationForm, id: parseInt(stationForm.id) };
    const res = stations.find(s => s.id === payload.id) ? await (window as any).api.updateStation(payload) : await (window as any).api.addStation(payload);
    if (res.success) { setShowStationForm(false); setStationForm({ id: '', name: '', region: '', equipment_type: 'Smart Meter' }); loadData(); } else alert("Error: " + res.error);
  };

  const toggleStationStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    const res = await (window as any).api.toggleStation({ id, status: newStatus }); if (res.success) loadData();
  };

  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(window as any).api) return;
    const res = await (window as any).api.addAuthOperator(operatorForm);
    if (res.success) {
      setShowOperatorForm(false);
      setOperatorForm({ username: '', name: '', role: 'Monitoring Operator', password: '' });
      loadData();
    } else alert("Error: " + res.error);
  };

  const NavItem = ({ tab, label }: { tab: any, label: string }) => (
    <div onClick={() => setActiveTab(tab)} style={{ color: activeTab === tab ? '#fff' : '#9e9e9e', padding: '10px 15px', cursor: 'pointer', backgroundColor: activeTab === tab ? '#333' : 'transparent', borderRadius: '5px', transition: 'all 0.2s', fontSize: '14px' }}>
      {label}
    </div>
  );

  const barChartData = {
    labels: analytics.tempByStation.map((t: any) => t.name),
    datasets: [{ label: 'Avg Temperature (°C)', data: analytics.tempByStation.map((t: any) => t.avg_temp), backgroundColor: 'rgba(255, 152, 0, 0.6)', borderColor: '#ff9800', borderWidth: 1 }]
  };

  // --- LOGIN SCREEN ---
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#121212', color: '#fff', fontFamily: 'Segoe UI' }}>
        <div style={{ backgroundColor: '#1e1e24', padding: '40px', borderRadius: '10px', border: '1px solid #333', width: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          <h1 style={{ color: '#4caf50', fontSize: '28px', textAlign: 'center', marginBottom: '30px' }}>GridWatch</h1>
          <h3 style={{ textAlign: 'center', marginBottom: '20px', color: '#9e9e9e' }}>Operator Login</h3>
          
          {loginError && <div style={{ backgroundColor: '#f44336', color: '#fff', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '14px' }}>{loginError}</div>}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input required placeholder="Username" value={loginData.username} onChange={e => setLoginData({ ...loginData, username: e.target.value })} style={{ padding: '12px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
            <input required type="password" placeholder="Password" value={loginData.password} onChange={e => setLoginData({ ...loginData, password: e.target.value })} style={{ padding: '12px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
            <button type="submit" style={{ backgroundColor: '#4caf50', color: '#fff', border: 'none', padding: '12px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginTop: '10px' }}>Login</button>
          </form>
          
          <div style={{ marginTop: '20px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
            <p>Demo accounts:</p>
            <p>admin / password123</p>
            <p>operator / password123</p>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP (Logged In) ---
  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#121212', color: '#fff', fontFamily: 'Segoe UI' }}>
      <aside style={{ width: '260px', backgroundColor: '#1e1e24', padding: '20px', borderRight: '1px solid #333', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <h1 style={{ color: '#4caf50', fontSize: '24px', marginBottom: '20px' }}>GridWatch</h1>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
          <NavItem tab="command" label="1. Command Center" />
          <NavItem tab="live" label="2. Live Monitoring" />
          <NavItem tab="stations" label="3. Stations" />
          <NavItem tab="anomalies" label="4. Anomaly Detection" />
          <NavItem tab="incidents" label="5. Incident Management" />
          <NavItem tab="alerts" label="6. Alert Center" />
          <NavItem tab="analytics" label="7. Energy Analytics" />
          <NavItem tab="jobs" label="8. Background Jobs" />
          <NavItem tab="events" label="9. System Events" />
          
          {currentUser.role === 'Administrator' && (
            <NavItem tab="operators" label="10. Operators" />
          )}
          
          <NavItem tab="reports" label="11. Reports" />
          <NavItem tab="settings" label="12. Settings" />
        </nav>

        <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }}>
          <div style={{ fontSize: '14px', marginBottom: '10px' }}>
            <strong>{currentUser.name}</strong><br />
            <span style={{ color: '#9e9e9e' }}>{currentUser.role}</span>
          </div>
          <button onClick={handleLogout} style={{ width: '100%', padding: '10px', backgroundColor: '#f44336', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Logout</button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h2 style={{ color: '#fff', textTransform: 'capitalize' }}>{activeTab.replace('-', ' ')}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: isConnected ? '#4caf50' : '#f44336' }}></span>
            <span style={{ color: isConnected ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>{isConnected ? 'WebSocket Connected' : 'Disconnected'}</span>
          </div>
        </header>

        {activeTab === 'command' && (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
              <div style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
                <h3 style={{ color: '#9e9e9e', fontSize: '14px', textTransform: 'uppercase' }}>Total Stations</h3>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#fff', marginTop: '10px' }}>{stations.length}</p>
              </div>
              <div style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
                <h3 style={{ color: '#9e9e9e', fontSize: '14px', textTransform: 'uppercase' }}>Online Stations</h3>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#4caf50', marginTop: '10px' }}>{Object.keys(latestReadings).length}</p>
              </div>
              <div style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
                <h3 style={{ color: '#9e9e9e', fontSize: '14px', textTransform: 'uppercase' }}>Avg Voltage</h3>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#2196f3', marginTop: '10px' }}>{Object.values(latestReadings).length > 0 ? (Object.values(latestReadings).reduce((sum, r) => sum + r.voltage, 0) / Object.values(latestReadings).length).toFixed(1) : '0'} V</p>
              </div>
              <div style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
                <h3 style={{ color: '#9e9e9e', fontSize: '14px', textTransform: 'uppercase' }}>Active Anomalies</h3>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#f44336', marginTop: '10px' }}>{anomalies.length}</p>
              </div>
            </section>
            <section style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333', marginBottom: '30px', height: '350px' }}>
              <h3 style={{ marginBottom: '20px', color: '#fff' }}>Live Voltage Telemetry (Station 1)</h3>
              <div style={{ height: '280px' }}>
                {chartData.labels.length > 0 ? <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, animation: false, scales: { y: { grid: { color: '#333' }, ticks: { color: '#9e9e9e' } }, x: { grid: { color: '#333' }, ticks: { color: '#9e9e9e' } } }, plugins: { legend: { labels: { color: '#fff' } } } }} /> : <p style={{ color: '#9e9e9e', textAlign: 'center', paddingTop: '100px' }}>Waiting for live telemetry...</p>}
              </div>
            </section>
          </>
        )}

        {activeTab === 'live' && (
          <section style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead><tr style={{ color: '#9e9e9e', borderBottom: '1px solid #333' }}><th style={{ padding: '10px' }}>Station Name</th><th style={{ padding: '10px' }}>Region</th><th style={{ padding: '10px' }}>Voltage (V)</th><th style={{ padding: '10px' }}>Current (A)</th><th style={{ padding: '10px' }}>Temp (°C)</th><th style={{ padding: '10px' }}>Power (W)</th></tr></thead>
              <tbody>{stations.map(station => { const reading = latestReadings[station.id]; return (<tr key={station.id} style={{ borderBottom: '1px solid #2a2a35', color: '#fff' }}><td style={{ padding: '12px 10px' }}>{station.name}</td><td style={{ padding: '12px 10px' }}>{station.region}</td><td style={{ padding: '12px 10px', color: reading ? '#4caf50' : '#9e9e9e' }}>{reading ? reading.voltage.toFixed(2) : '---'}</td><td style={{ padding: '12px 10px', color: reading ? '#2196f3' : '#9e9e9e' }}>{reading ? reading.current.toFixed(2) : '---'}</td><td style={{ padding: '12px 10px', color: reading && reading.temperature > 52 ? '#f44336' : '#ff9800' }}>{reading ? reading.temperature.toFixed(2) : '---'}</td><td style={{ padding: '12px 10px' }}>{reading ? reading.power_consumption.toFixed(0) : '---'}</td></tr>); })}</tbody>
            </table>
          </section>
        )}

        {activeTab === 'stations' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3>Registered Stations</h3>
              {(currentUser.role === 'Administrator' || currentUser.role === 'Monitoring Operator') && (
                <button onClick={() => setShowStationForm(!showStationForm)} style={{ backgroundColor: '#4caf50', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>{showStationForm ? 'Cancel' : '+ Register Station'}</button>
              )}
            </div>
            {showStationForm && (
              <div style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #4caf50', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px' }}>Register / Edit Station</h4>
                <form onSubmit={handleSaveStation} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <input required type="number" placeholder="Station ID (e.g. 11)" value={stationForm.id} onChange={e => setStationForm({...stationForm, id: e.target.value})} style={{ padding: '10px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                  <input required placeholder="Station Name" value={stationForm.name} onChange={e => setStationForm({...stationForm, name: e.target.value})} style={{ padding: '10px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                  <input required placeholder="Region" value={stationForm.region} onChange={e => setStationForm({...stationForm, region: e.target.value})} style={{ padding: '10px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                  <select value={stationForm.equipment_type} onChange={e => setStationForm({...stationForm, equipment_type: e.target.value})} style={{ padding: '10px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444' }}><option value="Smart Meter">Smart Meter</option><option value="Transformer">Transformer</option><option value="Solar Inverter">Solar Inverter</option></select>
                  <button type="submit" style={{ backgroundColor: '#4caf50', color: '#fff', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', gridColumn: 'span 2' }}>Save Station</button>
                </form>
              </div>
            )}
            <div style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead><tr style={{ color: '#9e9e9e', borderBottom: '1px solid #333' }}><th style={{ padding: '10px' }}>ID</th><th style={{ padding: '10px' }}>Name</th><th style={{ padding: '10px' }}>Region</th><th style={{ padding: '10px' }}>Type</th><th style={{ padding: '10px' }}>Status</th><th style={{ padding: '10px' }}>Actions</th></tr></thead>
                <tbody>{stations.map(s => (<tr key={s.id} style={{ borderBottom: '1px solid #2a2a35', color: '#fff' }}><td style={{ padding: '12px 10px' }}>{s.id}</td><td style={{ padding: '12px 10px' }}>{s.name}</td><td style={{ padding: '12px 10px' }}>{s.region}</td><td style={{ padding: '12px 10px' }}>{s.equipment_type}</td><td style={{ padding: '12px 10px', color: s.status === 'Active' ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>{s.status}</td><td style={{ padding: '12px 10px', display: 'flex', gap: '5px' }}>{currentUser.role === 'Administrator' && <><button onClick={() => { setStationForm(s); setShowStationForm(true); }} style={{ padding: '5px 10px', backgroundColor: '#2196f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Edit</button><button onClick={() => toggleStationStatus(s.id, s.status)} style={{ padding: '5px 10px', backgroundColor: s.status === 'Active' ? '#ff9800' : '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{s.status === 'Active' ? 'Deactivate' : 'Activate'}</button></>}</td></tr>))}</tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'incidents' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3>All Incidents</h3>
              {(currentUser.role === 'Administrator' || currentUser.role === 'Monitoring Operator') && (
                <button onClick={() => setShowIncidentForm(!showIncidentForm)} style={{ backgroundColor: '#4caf50', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>{showIncidentForm ? 'Cancel' : '+ Create Incident'}</button>
              )}
            </div>
            {showIncidentForm && (
              <div style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #4caf50', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px' }}>Create New Incident</h4>
                <form onSubmit={handleCreateIncident} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <select required value={incidentForm.station_id} onChange={e => setIncidentForm({...incidentForm, station_id: e.target.value})} style={{ padding: '10px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444' }}><option value="">Select Station</option>{stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  <input required placeholder="Incident Title" value={incidentForm.title} onChange={e => setIncidentForm({...incidentForm, title: e.target.value})} style={{ padding: '10px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                  <select required value={incidentForm.category} onChange={e => setIncidentForm({...incidentForm, category: e.target.value})} style={{ padding: '10px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444' }}><option value="Voltage">Voltage</option><option value="Temperature">Temperature</option><option value="Equipment Failure">Equipment Failure</option></select>
                  <select required value={incidentForm.severity} onChange={e => setIncidentForm({...incidentForm, severity: e.target.value})} style={{ padding: '10px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444' }}><option value="Warning">Warning</option><option value="High">High</option><option value="Critical">Critical</option></select>
                  <select value={incidentForm.assigned_operator_id} onChange={e => setIncidentForm({...incidentForm, assigned_operator_id: e.target.value})} style={{ padding: '10px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444' }}><option value="">Unassigned</option>{operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                  <input required placeholder="Description" value={incidentForm.description} onChange={e => setIncidentForm({...incidentForm, description: e.target.value})} style={{ padding: '10px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444', gridColumn: 'span 2' }} />
                  <button type="submit" style={{ backgroundColor: '#4caf50', color: '#fff', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', gridColumn: 'span 2' }}>Save Incident</button>
                </form>
              </div>
            )}
            <div style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead><tr style={{ color: '#9e9e9e', borderBottom: '1px solid #333' }}><th style={{ padding: '10px' }}>ID</th><th style={{ padding: '10px' }}>Station</th><th style={{ padding: '10px' }}>Title</th><th style={{ padding: '10px' }}>Severity</th><th style={{ padding: '10px' }}>Status</th><th style={{ padding: '10px' }}>Assigned To</th><th style={{ padding: '10px' }}>Actions</th></tr></thead>
                <tbody>{incidents.map(inc => (<tr key={inc.id} style={{ borderBottom: '1px solid #2a2a35', color: '#fff' }}><td style={{ padding: '12px 10px' }}>#{inc.id}</td><td style={{ padding: '12px 10px' }}>{inc.station_name}</td><td style={{ padding: '12px 10px' }}>{inc.title}</td><td style={{ padding: '12px 10px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: inc.severity === 'Critical' ? '#f44336' : inc.severity === 'High' ? '#ff9800' : '#2196f3' }}>{inc.severity}</span></td><td style={{ padding: '12px 10px' }}><span style={{ color: inc.status === 'Resolved' || inc.status === 'Closed' ? '#4caf50' : '#ff9800', fontWeight: 'bold' }}>{inc.status}</span></td><td style={{ padding: '12px 10px' }}>{inc.operator_name || 'Unassigned'}</td><td style={{ padding: '12px 10px' }}>{(currentUser.role === 'Administrator' || currentUser.role === 'Monitoring Operator') && (<>{inc.status === 'Open' && <button onClick={() => handleUpdateStatus(inc.id, 'Investigating')} style={{ marginRight: '5px', padding: '5px 10px', backgroundColor: '#2196f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Investigate</button>}{(inc.status === 'Open' || inc.status === 'Investigating') && <button onClick={() => handleUpdateStatus(inc.id, 'Resolved')} style={{ padding: '5px 10px', backgroundColor: '#4caf50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Resolve</button>}</>)}</td></tr>))}</tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <section style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
            <h3 style={{ marginBottom: '20px', color: '#fff' }}>Active Alerts & Anomalies</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead><tr style={{ color: '#9e9e9e', borderBottom: '1px solid #333' }}><th style={{ padding: '10px' }}>Time</th><th style={{ padding: '10px' }}>Station</th><th style={{ padding: '10px' }}>Category</th><th style={{ padding: '10px' }}>Severity</th><th style={{ padding: '10px' }}>Description</th></tr></thead>
              <tbody>{anomalies.map(a => (<tr key={a.id} style={{ borderBottom: '1px solid #2a2a35', color: '#fff' }}><td style={{ padding: '12px 10px', fontSize: '12px', color: '#9e9e9e' }}>{new Date(a.timestamp).toLocaleTimeString()}</td><td style={{ padding: '12px 10px' }}>{a.station_name}</td><td style={{ padding: '12px 10px' }}>{a.category}</td><td style={{ padding: '12px 10px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: a.severity === 'Critical' ? '#f44336' : a.severity === 'High' ? '#ff9800' : '#2196f3' }}>{a.severity}</span></td><td style={{ padding: '12px 10px' }}>{a.description} (Value: {a.detected_value.toFixed(1)})</td></tr>))}</tbody>
            </table>
          </section>
        )}

        {activeTab === 'analytics' && (
          <div>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '30px' }}>
              <div style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
                <h3 style={{ color: '#9e9e9e', fontSize: '14px', textTransform: 'uppercase' }}>Total Energy Generated</h3>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#4caf50', marginTop: '10px' }}>{analytics.energyStats?.total_generated ? analytics.energyStats.total_generated.toFixed(0) : '0'} kWh</p>
              </div>
              <div style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
                <h3 style={{ color: '#9e9e9e', fontSize: '14px', textTransform: 'uppercase' }}>Total Energy Consumed</h3>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#f44336', marginTop: '10px' }}>{analytics.energyStats?.total_consumed ? analytics.energyStats.total_consumed.toFixed(0) : '0'} Wh</p>
              </div>
            </section>
            <section style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333', height: '400px' }}>
              <h3 style={{ marginBottom: '20px', color: '#fff' }}>Average Temperature by Station</h3>
              <div style={{ height: '320px' }}>
                {analytics.tempByStation.length > 0 ? <Bar data={barChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#fff' } } }, scales: { y: { grid: { color: '#333' }, ticks: { color: '#9e9e9e' } }, x: { grid: { color: '#333' }, ticks: { color: '#9e9e9e' } } } }} /> : <p style={{ color: '#9e9e9e', textAlign: 'center', paddingTop: '100px' }}>Collecting data...</p>}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3>Background Processing Engine</h3>
              {(currentUser.role === 'Administrator' || currentUser.role === 'Analyst') && (
                <button onClick={handleStartJob} disabled={isJobRunning} style={{ backgroundColor: isJobRunning ? '#555' : '#4caf50', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: isJobRunning ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                  {isJobRunning ? 'Processing...' : 'Run Heavy Analytics Job'}
                </button>
              )}
            </div>
            <div style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead><tr style={{ color: '#9e9e9e', borderBottom: '1px solid #333' }}><th style={{ padding: '10px' }}>Job ID</th><th style={{ padding: '10px' }}>Type</th><th style={{ padding: '10px' }}>Status</th><th style={{ padding: '10px' }}>Start Time</th><th style={{ padding: '10px' }}>Duration</th><th style={{ padding: '10px' }}>Error Message</th></tr></thead>
                <tbody>{jobs.map(j => (<tr key={j.id} style={{ borderBottom: '1px solid #2a2a35', color: '#fff' }}><td style={{ padding: '12px 10px' }}>#{j.id}</td><td style={{ padding: '12px 10px' }}>{j.job_type}</td><td style={{ padding: '12px 10px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: j.status === 'Completed' ? '#4caf50' : j.status === 'Failed' ? '#f44336' : '#ff9800' }}>{j.status}</span></td><td style={{ padding: '12px 10px', fontSize: '12px', color: '#9e9e9e' }}>{new Date(j.start_time).toLocaleString()}</td><td style={{ padding: '12px 10px' }}>{j.duration_ms ? `${j.duration_ms} ms` : '---'}</td><td style={{ padding: '12px 10px', color: '#f44336', fontSize: '12px' }}>{j.error_message || '---'}</td></tr>))}</tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <section style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
            <h3 style={{ marginBottom: '20px', color: '#fff' }}>System Event Log</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead><tr style={{ color: '#9e9e9e', borderBottom: '1px solid #333' }}><th style={{ padding: '10px' }}>Time</th><th style={{ padding: '10px' }}>Event Type</th><th style={{ padding: '10px' }}>Description</th></tr></thead>
              <tbody>{events.map(ev => (<tr key={ev.id} style={{ borderBottom: '1px solid #2a2a35', color: '#fff' }}><td style={{ padding: '12px 10px', fontSize: '12px', color: '#9e9e9e' }}>{new Date(ev.created_at).toLocaleString()}</td><td style={{ padding: '12px 10px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#333', border: '1px solid #555' }}>{ev.event_type}</span></td><td style={{ padding: '12px 10px' }}>{ev.description}</td></tr>))}</tbody>
            </table>
          </section>
        )}

        {activeTab === 'operators' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3>Operator Management</h3>
              <button onClick={() => setShowOperatorForm(!showOperatorForm)} style={{ backgroundColor: '#4caf50', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>{showOperatorForm ? 'Cancel' : '+ Add New Operator'}</button>
            </div>
            {showOperatorForm && (
              <div style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #4caf50', marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '15px' }}>Create Operator Account</h4>
                <form onSubmit={handleCreateOperator} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <input required placeholder="Username" value={operatorForm.username} onChange={e => setOperatorForm({...operatorForm, username: e.target.value})} style={{ padding: '10px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                  <input required placeholder="Full Name" value={operatorForm.name} onChange={e => setOperatorForm({...operatorForm, name: e.target.value})} style={{ padding: '10px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                  <select value={operatorForm.role} onChange={e => setOperatorForm({...operatorForm, role: e.target.value})} style={{ padding: '10px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444' }}>
                    <option value="Administrator">Administrator</option>
                    <option value="Monitoring Operator">Monitoring Operator</option>
                    <option value="Analyst">Analyst</option>
                    <option value="Read-only Viewer">Read-only Viewer</option>
                  </select>
                  <input required type="password" placeholder="Password" value={operatorForm.password} onChange={e => setOperatorForm({...operatorForm, password: e.target.value})} style={{ padding: '10px', borderRadius: '5px', background: '#121212', color: '#fff', border: '1px solid #444' }} />
                  <button type="submit" style={{ backgroundColor: '#4caf50', color: '#fff', border: 'none', padding: '10px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', gridColumn: 'span 2' }}>Create Account</button>
                </form>
              </div>
            )}
            <div style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead><tr style={{ color: '#9e9e9e', borderBottom: '1px solid #333' }}><th style={{ padding: '10px' }}>ID</th><th style={{ padding: '10px' }}>Username</th><th style={{ padding: '10px' }}>Full Name</th><th style={{ padding: '10px' }}>Role</th></tr></thead>
                <tbody>{operators.map(o => (<tr key={o.id} style={{ borderBottom: '1px solid #2a2a35', color: '#fff' }}><td style={{ padding: '12px 10px' }}>{o.id}</td><td style={{ padding: '12px 10px' }}>{o.username}</td><td style={{ padding: '12px 10px' }}>{o.name}</td><td style={{ padding: '12px 10px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: o.role === 'Administrator' ? '#f44336' : o.role === 'Monitoring Operator' ? '#ff9800' : o.role === 'Analyst' ? '#2196f3' : '#666' }}>{o.role}</span></td></tr>))}</tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div>
            <div style={{ backgroundColor: '#1e1e24', padding: '20px', borderRadius: '10px', border: '1px solid #333' }}>
              <h3 style={{ marginBottom: '20px' }}>Export Data to CSV</h3>
              <p style={{ color: '#9e9e9e', marginBottom: '20px' }}>Download system data to CSV files for analysis in Excel.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ backgroundColor: '#121212', padding: '20px', borderRadius: '5px', border: '1px solid #444', textAlign: 'center' }}>
                  <h4>Incidents Report</h4>
                  <p style={{ fontSize: '12px', color: '#9e9e9e', marginBottom: '10px' }}>Export all incident records and resolutions.</p>
                  <button onClick={async () => { const res = await (window as any).api.exportReport('incidents'); alert(res.message); }} style={{ backgroundColor: '#2196f3', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', width: '100%' }}>Download CSV</button>
                </div>
                
                <div style={{ backgroundColor: '#121212', padding: '20px', borderRadius: '5px', border: '1px solid #444', textAlign: 'center' }}>
                  <h4>Telemetry Report</h4>
                  <p style={{ fontSize: '12px', color: '#9e9e9e', marginBottom: '10px' }}>Export last 1000 telemetry readings.</p>
                  <button onClick={async () => { const res = await (window as any).api.exportReport('telemetry'); alert(res.message); }} style={{ backgroundColor: '#4caf50', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', width: '100%' }}>Download CSV</button>
                </div>
                
                <div style={{ backgroundColor: '#121212', padding: '20px', borderRadius: '5px', border: '1px solid #444', textAlign: 'center' }}>
                  <h4>System Events Report</h4>
                  <p style={{ fontSize: '12px', color: '#9e9e9e', marginBottom: '10px' }}>Export audit log of all system events.</p>
                  <button onClick={async () => { const res = await (window as any).api.exportReport('events'); alert(res.message); }} style={{ backgroundColor: '#ff9800', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', width: '100%' }}>Download CSV</button>
                </div>
                
                <div style={{ backgroundColor: '#121212', padding: '20px', borderRadius: '5px', border: '1px solid #444', textAlign: 'center' }}>
                  <h4>Operators Report</h4>
                  <p style={{ fontSize: '12px', color: '#9e9e9e', marginBottom: '10px' }}>Export list of all registered operators.</p>
                  <button onClick={async () => { const res = await (window as any).api.exportReport('operators'); alert(res.message); }} style={{ backgroundColor: '#9c27b0', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', width: '100%' }}>Download CSV</button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {['anomalies', 'settings'].includes(activeTab) && (
          <div style={{ textAlign: 'center', paddingTop: '100px', color: '#9e9e9e' }}>
            <h2 style={{ textTransform: 'capitalize' }}>{activeTab.replace('-', ' ')} Module</h2>
            <p>This section will be built in the next phase of development.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;