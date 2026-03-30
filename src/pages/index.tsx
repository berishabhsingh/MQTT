import { useEffect, useMemo, useState } from 'react';

type Session = { authenticated: boolean; username: string | null };
type Device = { endpointId: string; online: boolean; lastSeen: string };
type LogEntry = { timestamp: string; direction: string; topic?: string; fromId?: string; toId?: string; text?: string; message?: unknown };

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

export default function Home() {
  const [session, setSession] = useState<Session>({ authenticated: false, username: null });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<{ connected?: boolean; brokerUrl?: string; topicPrefix?: string; controllerId?: string }>({});
  const [selected, setSelected] = useState('');
  const [getPaths, setGetPaths] = useState('Device.DeviceInfo.SoftwareVersion');
  const [setPath, setSetPath] = useState('');
  const [setValue, setSetValue] = useState('');
  const [notice, setNotice] = useState('');

  const selectedDevice = useMemo(() => devices.find((d) => d.endpointId === selected), [devices, selected]);

  async function loadSession() {
    const data = await jsonFetch<Session>('/api/auth/session');
    setSession(data);
  }

  async function loadDashboard() {
    const [deviceData, logData, statusData] = await Promise.all([
      jsonFetch<{ devices: Device[] }>('/api/usp/devices'),
      jsonFetch<{ logs: LogEntry[] }>('/api/usp/logs'),
      jsonFetch<{ connected: boolean; brokerUrl: string; topicPrefix: string; controllerId: string }>('/api/usp/status')
    ]);
    setDevices(deviceData.devices);
    setLogs(logData.logs);
    setStatus(statusData);
    if (!selected && deviceData.devices[0]) {
      setSelected(deviceData.devices[0].endpointId);
    }
  }

  useEffect(() => {
    loadSession().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!session.authenticated) return;
    loadDashboard().catch((err) => setError(err.message));
    const id = setInterval(() => {
      loadDashboard().catch(() => undefined);
    }, 3000);
    return () => clearInterval(id);
  }, [session.authenticated]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await jsonFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      await loadSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  async function handleLogout() {
    await jsonFetch('/api/auth/logout', { method: 'POST' });
    setSession({ authenticated: false, username: null });
    setDevices([]);
    setLogs([]);
  }

  async function handleGet(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return setNotice('Select a device first');
    try {
      await jsonFetch('/api/usp/get', {
        method: 'POST',
        body: JSON.stringify({ endpointId: selected, paths: getPaths.split(',').map((p) => p.trim()).filter(Boolean) })
      });
      setNotice('Get sent');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Get failed');
    }
  }

  async function handleSet(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return setNotice('Select a device first');
    if (!setPath) return setNotice('Enter a writable parameter path');
    try {
      await jsonFetch('/api/usp/set', {
        method: 'POST',
        body: JSON.stringify({ endpointId: selected, params: { [setPath]: setValue } })
      });
      setNotice('Set sent');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Set failed');
    }
  }

  if (!session.authenticated) {
    return (
      <div className="page" style={{ maxWidth: 460, paddingTop: 72 }}>
        <div className="card stack">
          <h1 className="title">USP Controller</h1>
          <div className="subtle">Database-free Render deployment. Login uses the username/password you set in Render env vars.</div>
          <form className="stack" onSubmit={handleLogin}>
            <input className="input" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="btn" type="submit">Login</button>
          </form>
          {error && <div className="notice">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="header">
        <div>
          <h1 className="title">USP / TR-369 Controller Dashboard</h1>
          <div className="subtle">Signed in as {session.username}</div>
        </div>
        <div className="row">
          <div className="badge"><span className={`dot ${status.connected ? 'good' : 'bad'}`}></span>{status.connected ? 'Broker connected' : 'Broker disconnected'}</div>
          <button className="btn secondary" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="grid">
        <div className="stack">
          <div className="card stack">
            <div><strong>Broker</strong></div>
            <div className="subtle">{status.brokerUrl || '—'}</div>
            <div><strong>Topic Prefix</strong></div>
            <div className="subtle">{status.topicPrefix || '—'}</div>
            <div><strong>Controller ID</strong></div>
            <div className="subtle">{status.controllerId || '—'}</div>
          </div>

          <div className="card">
            <div className="header" style={{ marginBottom: 12 }}>
              <strong>Devices</strong>
              <span className="subtle">{devices.length}</span>
            </div>
            <div className="list">
              {devices.length === 0 && <div className="subtle">No devices discovered yet.</div>}
              {devices.map((device) => (
                <button key={device.endpointId} className={`device ${selected === device.endpointId ? 'active' : ''}`} onClick={() => setSelected(device.endpointId)}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <strong>{device.endpointId}</strong>
                    <span className="badge"><span className={`dot ${device.online ? 'good' : 'bad'}`}></span>{device.online ? 'Online' : 'Offline'}</span>
                  </div>
                  <div className="subtle" style={{ marginTop: 8 }}>Last seen: {new Date(device.lastSeen).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card stack">
            <div className="header" style={{ marginBottom: 0 }}>
              <strong>Selected Device</strong>
              <span className="subtle">{selectedDevice?.endpointId || 'None'}</span>
            </div>
            <div className="two">
              <form className="stack" onSubmit={handleGet}>
                <strong>Read Parameters</strong>
                <textarea className="textarea" value={getPaths} onChange={(e) => setGetPaths(e.target.value)} />
                <button className="btn" type="submit">Send Get</button>
              </form>
              <form className="stack" onSubmit={handleSet}>
                <strong>Write Parameter</strong>
                <input className="input" placeholder="Device.X.Y.Z" value={setPath} onChange={(e) => setSetPath(e.target.value)} />
                <input className="input" placeholder="New value" value={setValue} onChange={(e) => setSetValue(e.target.value)} />
                <button className="btn" type="submit">Send Set</button>
              </form>
            </div>
            {notice && <div className="notice">{notice}</div>}
          </div>

          <div className="card">
            <div className="header" style={{ marginBottom: 8 }}>
              <strong>Live Logs</strong>
              <span className="subtle">Newest first</span>
            </div>
            <div className="logs">
              {logs.map((log, index) => (
                <div className="log" key={`${log.timestamp}-${index}`}>
                  <div>{log.timestamp} [{log.direction}] {log.topic || ''}</div>
                  {(log.fromId || log.toId) && <div>from={log.fromId || '-'} to={log.toId || '-'}</div>}
                  {log.text ? <div>{log.text}</div> : <div>{JSON.stringify(log.message, null, 2)}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
