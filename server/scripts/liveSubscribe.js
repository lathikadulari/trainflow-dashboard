const path = require('path');
const dotenv = require('dotenv');
const mqtt = require('mqtt');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const topic = process.argv[2] || process.env.MQTT_SUB_TOPIC || 'trainflow/#';

const options = {
  host: process.env.MQTT_HOST || '13.235.248.117',
  port: Number(process.env.MQTT_PORT || 1883),
  protocol: process.env.MQTT_PROTOCOL || 'mqtt',
  username: process.env.MQTT_USERNAME || 'trainflow',
  password: process.env.MQTT_PASSWORD || 'Trainflow@2026!',
  connectTimeout: 8000,
  reconnectPeriod: 2000,
};

console.log('MQTT live subscriber starting...');
console.log(`Broker: ${options.protocol}://${options.host}:${options.port}`);
console.log(`Topic: ${topic}`);

const client = mqtt.connect(options);

client.on('connect', () => {
  console.log('Connected. Waiting for messages...');
  client.subscribe(topic, (err) => {
    if (err) {
      console.error('Subscribe error:', err.message);
      process.exit(1);
    }
  });
});

client.on('message', (msgTopic, message) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msgTopic} -> ${message.toString()}`);
});

client.on('reconnect', () => {
  console.log('Reconnecting...');
});

client.on('error', (err) => {
  console.error('MQTT error:', err.message);
});

process.on('SIGINT', () => {
  console.log('\nStopping subscriber...');
  client.end(true, () => process.exit(0));
});
