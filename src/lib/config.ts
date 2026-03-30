export const config = {
  appUsername: process.env.APP_USERNAME || 'admin',
  appPassword: process.env.APP_PASSWORD || 'change-this-password',
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
  mqttBrokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  mqttUsername: process.env.MQTT_USERNAME || '',
  mqttPassword: process.env.MQTT_PASSWORD || '',
  mqttTls: (process.env.MQTT_TLS || 'false') === 'true',
  mqttRejectUnauthorized: (process.env.MQTT_REJECT_UNAUTHORIZED || 'true') === 'true',
  controllerId: process.env.USP_CONTROLLER_ID || 'usp-controller-render',
  deviceTopicPrefix: process.env.DEVICE_TOPIC_PREFIX || 'usp',
  logBufferSize: Number(process.env.LOG_BUFFER_SIZE || 500),
  deviceOfflineAfterMs: Number(process.env.DEVICE_OFFLINE_AFTER_MS || 180000)
};
