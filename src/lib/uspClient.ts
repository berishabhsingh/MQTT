import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { load, Root, Type } from 'protobufjs';
import { PrismaClient, Device, Parameter } from '@prisma/client';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

interface ConnectOptions {
  url: string;
  username?: string;
  password?: string;
  tls?: boolean;
}

/**
 * USPClient encapsulates the connection to an MQTT broker and manages
 * encoding/decoding of USP records and messages.  It maintains a cache of
 * devices and emits events whenever messages are sent or received.  The
 * implementation is deliberately simplified; only Get and Set operations are
 * implemented.  See the USP specification for details on other messages.
 */
export class USPClient extends EventEmitter {
  private prisma: PrismaClient;
  private mqttClient: MqttClient | null = null;
  private recordType: Type | null = null;
  private messageType: Type | null = null;
  private controllerId: string;
  private devices: Map<string, Device> = new Map();

  /**
   * In‑memory ring buffer of log entries.  Each entry records the direction
   * ('in' or 'out'), fromId/toId, and decoded message.  The buffer is used
   * by the API to return recent activity to the front end.
   */
  private logs: any[] = [];
  private readonly maxLogEntries = 500;

  constructor() {
    super();
    this.prisma = new PrismaClient();
    // Use configured controller ID or generate a random one
    this.controllerId = process.env.USP_CONTROLLER_ID || uuidv4();
  }

  /**
   * Initialize the USP client by loading protobuf definitions.  Returns a
   * promise that resolves when the definitions are loaded.
   */
  async initProtos(): Promise<void> {
    const recordRoot: Root = await load(`${process.cwd()}/proto/usp-record.proto`);
    const msgRoot: Root = await load(`${process.cwd()}/proto/usp-msg.proto`);
    this.recordType = recordRoot.lookupType('usp.Record');
    this.messageType = msgRoot.lookupType('usp.Message');
  }

  /**
   * Connect to the MQTT broker with the given options.  If already connected,
   * the previous connection will be closed first.  The client subscribes to
   * the wildcard topic `usp/#` to receive all USP records.  Devices are
   * discovered based on incoming record `from_id` values.
   */
  async connect(opts: ConnectOptions): Promise<void> {
    if (!this.recordType || !this.messageType) {
      await this.initProtos();
    }
    // Disconnect existing client
    if (this.mqttClient) {
      try {
        this.mqttClient.end(true);
      } catch (err) {
        console.error('Error closing MQTT client', err);
      }
    }
    const { url, username, password, tls } = opts;
    const mqttOpts: IClientOptions = {
      clientId: this.controllerId,
      username,
      password,
      clean: false,
      reconnectPeriod: 5000,
      connectTimeout: 30 * 1000,
    };
    if (tls) {
      mqttOpts.protocol = 'mqtts';
    }
    return new Promise((resolve, reject) => {
      this.mqttClient = mqtt.connect(url, mqttOpts);
      this.mqttClient.on('connect', () => {
        console.log('MQTT connected');
        this.mqttClient!.subscribe('usp/#', (err) => {
          if (err) {
            console.error('Failed to subscribe to usp/#', err);
            return reject(err);
          }
          resolve();
        });
      });
      this.mqttClient.on('message', (topic: string, payload: Buffer) => {
        this.handleMessage(topic, payload).catch((err) => {
          console.error('Error handling message:', err);
        });
      });
      this.mqttClient.on('error', (err) => {
        console.error('MQTT error', err);
      });
      this.mqttClient.on('reconnect', () => {
        console.warn('MQTT reconnecting');
      });
    });
  }

  /**
   * Handle an incoming MQTT message.  The payload is expected to be a USP
   * Record encoded with protobuf.  Decoding errors are logged but do not
   * terminate the client.
   */
  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    if (!this.recordType || !this.messageType) return;
    try {
      const recordMsg = this.recordType.decode(payload) as any;
      const fromId = recordMsg.from_id;
      const toId = recordMsg.to_id;
      const msgBuf: Buffer = recordMsg.payload;
      const msg = this.messageType.decode(msgBuf) as any;
      // Update device record in database
      await this.upsertDevice(fromId);
      const entry = { timestamp: new Date().toISOString(), direction: 'in', fromId, toId, msg };
      this.logs.push(entry);
      if (this.logs.length > this.maxLogEntries) this.logs.shift();
      this.emit('log', entry);
    } catch (err) {
      console.error('Failed to decode USP record', err);
    }
  }

  /**
   * Ensure that a device exists in the database and update its `lastSeen` and
   * `online` status.
   */
  private async upsertDevice(endpointId: string): Promise<void> {
    const now = new Date();
    const existing = await this.prisma.device.findUnique({ where: { endpointId } });
    if (existing) {
      await this.prisma.device.update({ where: { endpointId }, data: { lastSeen: now, online: true } });
    } else {
      await this.prisma.device.create({ data: { endpointId, lastSeen: now, online: true } });
    }
  }

  /**
   * Send a Get request to a USP agent to retrieve the values of one or more
   * parameters.  Returns a promise that resolves when the message has been
   * published.  Responses will be delivered asynchronously via `handleMessage`.
   */
  async sendGet(toId: string, paramPaths: string[]): Promise<void> {
    if (!this.mqttClient || !this.recordType || !this.messageType) {
      throw new Error('USPClient is not connected');
    }
    // Build USP Message
    const getMsgPayload = this.messageType!.encode({ get: { param_paths: paramPaths } }).finish();
    const recordPayload = this.recordType!.encode({
      to_id: toId,
      from_id: this.controllerId,
      payload: getMsgPayload,
    }).finish();
    await this.publish(toId, recordPayload);
    const entry = { timestamp: new Date().toISOString(), direction: 'out', toId, msg: { get: { param_paths: paramPaths } } };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogEntries) this.logs.shift();
    this.emit('log', entry);
  }

  /**
   * Send a Set request to a USP agent to update one or more parameters.  Values
   * must be provided as an object keyed by the parameter path.
   */
  async sendSet(toId: string, params: Record<string, string>): Promise<void> {
    if (!this.mqttClient || !this.recordType || !this.messageType) {
      throw new Error('USPClient is not connected');
    }
    const param_settings = Object.entries(params).map(([param, value]) => ({ param, value }));
    const setMsgPayload = this.messageType!.encode({ set: { param_settings } }).finish();
    const recordPayload = this.recordType!.encode({
      to_id: toId,
      from_id: this.controllerId,
      payload: setMsgPayload,
    }).finish();
    await this.publish(toId, recordPayload);
    const entry = { timestamp: new Date().toISOString(), direction: 'out', toId, msg: { set: params } };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogEntries) this.logs.shift();
    this.emit('log', entry);
  }

  /**
   * Publish a USP record to the agent's topic.  By convention this implementation
   * publishes to `usp/<EndpointID>`; agents should subscribe to their own
   * EndpointID topic.  See the USP specification for discovery details.
   */
  private async publish(toId: string, payload: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const topic = `usp/${toId}`;
      this.mqttClient!.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  /**
   * Get the current list of devices from the database.  Devices that have not
   * been seen within the last five minutes are considered offline.
   */
  async getDevices(): Promise<Device[]> {
    const devices = await this.prisma.device.findMany();
    const now = Date.now();
    const offlineThreshold = 5 * 60 * 1000;
    return devices.map((d) => ({
      ...d,
      online: now - d.lastSeen.getTime() < offlineThreshold,
    }));
  }

  /**
   * Return a snapshot of recent logs.  Used by the `/api/usp/logs` route.
   */
  getLogs() {
    return this.logs.slice();
  }
}

// Export a singleton client instance
export const uspClient = new USPClient();