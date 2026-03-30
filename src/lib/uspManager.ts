import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { load, type Type } from 'protobufjs';
import { EventEmitter } from 'events';
import { config } from './config';

export type DeviceInfo = {
  endpointId: string;
  online: boolean;
  lastSeen: string;
};

export type LogEntry = {
  timestamp: string;
  direction: 'in' | 'out' | 'system';
  topic?: string;
  fromId?: string;
  toId?: string;
  message?: unknown;
  text?: string;
};

class USPManager extends EventEmitter {
  private client: MqttClient | null = null;
  private recordType: Type | null = null;
  private messageType: Type | null = null;
  private logs: LogEntry[] = [];
  private devices = new Map<string, DeviceInfo>();
  private initialized = false;
  private currentUrl = '';

  async init() {
    if (this.initialized) return;
    const recordRoot = await load(`${process.cwd()}/proto/usp-record.proto`);
    const messageRoot = await load(`${process.cwd()}/proto/usp-msg.proto`);
    this.recordType = recordRoot.lookupType('usp.Record');
    this.messageType = messageRoot.lookupType('usp.Message');
    this.initialized = true;
  }

  async connect() {
    await this.init();
    if (this.client && this.client.connected && this.currentUrl === config.mqttBrokerUrl) {
      return;
    }

    if (this.client) {
      this.client.end(true);
      this.client = null;
    }

    const options: IClientOptions = {
      username: config.mqttUsername || undefined,
      password: config.mqttPassword || undefined,
      clientId: config.controllerId,
      clean: false,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      protocolVersion: 5,
      rejectUnauthorized: config.mqttRejectUnauthorized
    };

    this.currentUrl = config.mqttBrokerUrl;
    this.log({ direction: 'system', text: `Connecting to ${config.mqttBrokerUrl}` });

    this.client = mqtt.connect(config.mqttBrokerUrl, options);

    this.client.on('connect', () => {
      this.log({ direction: 'system', text: 'MQTT connected' });
      this.client?.subscribe(`${config.deviceTopicPrefix}/#`, { qos: 1 }, (err) => {
        if (err) {
          this.log({ direction: 'system', text: `Subscribe failed: ${err.message}` });
          return;
        }
        this.log({ direction: 'system', text: `Subscribed to ${config.deviceTopicPrefix}/#` });
      });
    });

    this.client.on('reconnect', () => this.log({ direction: 'system', text: 'MQTT reconnecting' }));
    this.client.on('close', () => this.log({ direction: 'system', text: 'MQTT connection closed' }));
    this.client.on('error', (err) => this.log({ direction: 'system', text: `MQTT error: ${err.message}` }));
    this.client.on('message', (topic, payload) => {
      void this.handleMessage(topic, payload);
    });
  }

  async ensureConnected() {
    if (!this.client || !this.client.connected) {
      await this.connect();
    }
  }

  private updateDevice(endpointId: string) {
    this.devices.set(endpointId, {
      endpointId,
      online: true,
      lastSeen: new Date().toISOString()
    });
  }

  private log(entry: LogEntry) {
    this.logs.push({ timestamp: new Date().toISOString(), ...entry });
    if (this.logs.length > config.logBufferSize) {
      this.logs.shift();
    }
  }

  private async handleMessage(topic: string, payload: Buffer) {
    if (!this.recordType || !this.messageType) return;
    try {
      const record = this.recordType.decode(payload) as unknown as { from_id?: string; to_id?: string; payload?: Uint8Array };
      const msg = record.payload ? this.messageType.decode(record.payload) : null;
      if (record.from_id) this.updateDevice(record.from_id);
      this.log({
        direction: 'in',
        topic,
        fromId: record.from_id,
        toId: record.to_id,
        message: msg
      });
    } catch {
      this.log({
        direction: 'in',
        topic,
        text: payload.toString('utf8')
      });
    }
  }

  getDevices() {
    const now = Date.now();
    return Array.from(this.devices.values()).map((device) => ({
      ...device,
      online: now - new Date(device.lastSeen).getTime() < config.deviceOfflineAfterMs
    }));
  }

  getLogs() {
    return [...this.logs].reverse();
  }

  getStatus() {
    return {
      connected: Boolean(this.client?.connected),
      brokerUrl: config.mqttBrokerUrl,
      topicPrefix: config.deviceTopicPrefix,
      controllerId: config.controllerId
    };
  }

  async sendGet(endpointId: string, paths: string[]) {
    await this.ensureConnected();
    if (!this.recordType || !this.messageType || !this.client) throw new Error('USP manager not initialized');

    const messagePayload = this.messageType.encode({ get: { param_paths: paths } }).finish();
    const recordPayload = this.recordType.encode({
      to_id: endpointId,
      from_id: config.controllerId,
      payload: messagePayload
    }).finish();

    const topic = `${config.deviceTopicPrefix}/${endpointId}`;
    await new Promise<void>((resolve, reject) => {
      this.client?.publish(topic, recordPayload, { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    this.log({ direction: 'out', topic, toId: endpointId, message: { get: { paths } } });
  }

  async sendSet(endpointId: string, params: Record<string, string>) {
    await this.ensureConnected();
    if (!this.recordType || !this.messageType || !this.client) throw new Error('USP manager not initialized');

    const param_settings = Object.entries(params).map(([param, value]) => ({ param, value }));
    const messagePayload = this.messageType.encode({ set: { param_settings } }).finish();
    const recordPayload = this.recordType.encode({
      to_id: endpointId,
      from_id: config.controllerId,
      payload: messagePayload
    }).finish();

    const topic = `${config.deviceTopicPrefix}/${endpointId}`;
    await new Promise<void>((resolve, reject) => {
      this.client?.publish(topic, recordPayload, { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    this.log({ direction: 'out', topic, toId: endpointId, message: { set: params } });
  }
}

export const uspManager = new USPManager();
