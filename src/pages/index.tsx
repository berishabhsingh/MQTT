import { useEffect, useState } from 'react';

interface Device {
  id: number;
  endpointId: string;
  name?: string | null;
  lastSeen: string;
  online: boolean;
}

interface LogEntry {
  timestamp: string;
  direction: 'in' | 'out';
  fromId?: string;
  toId?: string;
  msg: any;
}

/**
 * Dashboard page.  Provides a broker connection form, displays discovered
 * devices, allows parameter Get/Set operations, and shows a live log.
 */
export default function Home() {
  // Connection form state
  const [brokerUrl, setBrokerUrl] = useState('mqtt://localhost:1883');
  const [mqttUser, setMqttUser] = useState('');
  const [mqttPass, setMqttPass] = useState('');
  const [mqttTls, setMqttTls] = useState(false);
  const [connectStatus, setConnectStatus] = useState<string>('');

  // Device list
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);

  // Parameter get form
  const [paramGetPaths, setParamGetPaths] = useState('Device.DeviceInfo.SoftwareVersion');
  const [getMessage, setGetMessage] = useState('');

  // Parameter set form
  const [setParam, setSetParam] = useState('');
  const [setValue, setSetValue] = useState('');
  const [setMessage, setSetMessage] = useState('');

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Poll devices periodically
  useEffect(() => {
    async function fetchDevices() {
      try {
        const res = await fetch('/api/usp/devices');
        const data = await res.json();
        setDevices(data.devices || []);
      } catch (err) {
        console.error('Failed to fetch devices', err);
      }
    }
    fetchDevices();
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll logs periodically
  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch('/api/usp/logs');
        const data = await res.json();
        setLogs(data.logs || []);
      } catch (err) {
        console.error('Failed to fetch logs', err);
      }
    }
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  // Handle broker connection
  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnectStatus('Connecting…');
    try {
      const res = await fetch('/api/usp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: brokerUrl, username: mqttUser || undefined, password: mqttPass || undefined, tls: mqttTls }),
      });
      if (res.ok) {
        setConnectStatus('Connected');
      } else {
        const data = await res.json();
        setConnectStatus(`Error: ${data.error || 'Failed'}`);
      }
    } catch (err: any) {
      setConnectStatus('Error connecting');
    }
  }

  // Handle Get request
  async function handleGet(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEndpoint) {
      setGetMessage('Select a device first');
      return;
    }
    try {
      const res = await fetch(`/api/usp/parameters?endpointId=${encodeURIComponent(selectedEndpoint)}&paths=${encodeURIComponent(paramGetPaths)}`);
      const data = await res.json();
      if (res.ok) {
        setGetMessage(data.status);
      } else {
        setGetMessage(data.error || 'Error');
      }
    } catch (err) {
      setGetMessage('Error sending Get request');
    }
  }

  // Handle Set request
  async function handleSet(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEndpoint) {
      setSetMessage('Select a device first');
      return;
    }
    if (!setParam) {
      setSetMessage('Specify a parameter');
      return;
    }
    try {
      const res = await fetch(`/api/usp/parameters?endpointId=${encodeURIComponent(selectedEndpoint)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: { [setParam]: setValue } }),
      });
      const data = await res.json();
      if (res.ok) {
        setSetMessage(data.status);
      } else {
        setSetMessage(data.error || 'Error');
      }
    } catch (err) {
      setSetMessage('Error sending Set request');
    }
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>USP Controller Dashboard</h1>
      <section style={{ marginBottom: '2rem' }}>
        <h2>MQTT Connection</h2>
        <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', maxWidth: '400px' }}>
          <label>Broker URL
            <input value={brokerUrl} onChange={(e) => setBrokerUrl(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>Username
            <input value={mqttUser} onChange={(e) => setMqttUser(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>Password
            <input type="password" value={mqttPass} onChange={(e) => setMqttPass(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label>
            <input type="checkbox" checked={mqttTls} onChange={(e) => setMqttTls(e.target.checked)} /> Use TLS
          </label>
          <button type="submit">Connect</button>
        </form>
        {connectStatus && <p><strong>Status:</strong> {connectStatus}</p>}
      </section>
      <section style={{ marginBottom: '2rem' }}>
        <h2>Devices</h2>
        {devices.length === 0 && <p>No devices discovered yet.</p>}
        <ul>
          {devices.map((d) => (
            <li key={d.endpointId} style={{ cursor: 'pointer', fontWeight: selectedEndpoint === d.endpointId ? 'bold' : 'normal' }} onClick={() => setSelectedEndpoint(d.endpointId)}>
              {d.endpointId} {d.online ? '(online)' : '(offline)'}
            </li>
          ))}
        </ul>
      </section>
      {selectedEndpoint && (
        <section style={{ marginBottom: '2rem' }}>
          <h2>Device: {selectedEndpoint}</h2>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <form onSubmit={handleGet} style={{ flex: 1 }}>
              <h3>Get parameters</h3>
              <label>Paths (comma separated)
                <input value={paramGetPaths} onChange={(e) => setParamGetPaths(e.target.value)} style={{ width: '100%' }} />
              </label>
              <button type="submit">Send Get</button>
              {getMessage && <p>{getMessage}</p>}
            </form>
            <form onSubmit={handleSet} style={{ flex: 1 }}>
              <h3>Set parameter</h3>
              <label>Parameter path
                <input value={setParam} onChange={(e) => setSetParam(e.target.value)} style={{ width: '100%' }} />
              </label>
              <label>Value
                <input value={setValue} onChange={(e) => setSetValue(e.target.value)} style={{ width: '100%' }} />
              </label>
              <button type="submit">Send Set</button>
              {setMessage && <p>{setMessage}</p>}
            </form>
          </div>
        </section>
      )}
      <section>
        <h2>Logs</h2>
        <pre style={{ maxHeight: '300px', overflowY: 'scroll', background: '#f5f5f5', padding: '1rem' }}>
          {logs.map((log, idx) => (
            <div key={idx}>
              {log.timestamp} {log.direction === 'in' ? '<-' : '->'} {log.fromId || ''}{log.toId ? ` → ${log.toId}` : ''} {JSON.stringify(log.msg)}
            </div>
          ))}
        </pre>
      </section>
    </div>
  );
}