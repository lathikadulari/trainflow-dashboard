const path = require('path');
const mqtt = require('mqtt');
const dotenv = require('dotenv');

// Load server .env so this script can run independently of backend/frontend.
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SAMPLE_RATE_HZ = Number(process.env.ANALYZER_SAMPLE_RATE || 10);
const WINDOW_SECONDS = Number(process.env.ANALYZER_WINDOW_SECONDS || 20);
const REPORT_EVERY_MS = Number(process.env.ANALYZER_REPORT_MS || 1000);
const WINDOW_SIZE = Math.max(16, Math.round(SAMPLE_RATE_HZ * WINDOW_SECONDS));

const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = Number(process.env.MQTT_PORT || 8883);
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;

if (!MQTT_HOST || !MQTT_USERNAME || !MQTT_PASSWORD) {
  console.error('Missing MQTT credentials in server/.env');
  process.exit(1);
}

const topics = [
  'trainflow/sensor/A',
  'trainflow/sensor/B',
  'makumbura/sensor1',
  'makumbura/sensor2'
];

const state = {
  A: { x: [], z: [], count: 0, lastTs: 0 },
  B: { x: [], z: [], count: 0, lastTs: 0 }
};

function pushLimited(arr, value) {
  arr.push(value);
  if (arr.length > WINDOW_SIZE) arr.shift();
}

function mean(values) {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

function rms(values) {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v * v;
  return Math.sqrt(s / values.length);
}

function std(values, m) {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) {
    const d = v - m;
    s += d * d;
  }
  return Math.sqrt(s / values.length);
}

function ptp(values) {
  if (values.length === 0) return 0;
  let minV = values[0];
  let maxV = values[0];
  for (const v of values) {
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  return maxV - minV;
}

function dominantFrequency(values, fs) {
  const n = values.length;
  if (n < 32) return { hz: 0, magnitude: 0 };

  const m = mean(values);
  const centered = values.map((v) => v - m);

  let bestK = 1;
  let bestMag = 0;
  const maxK = Math.floor(n / 2);

  // Naive DFT over current window. Small n keeps it fast enough for 1 Hz reports.
  for (let k = 1; k <= maxK; k += 1) {
    let re = 0;
    let im = 0;
    const w = (2 * Math.PI * k) / n;
    for (let i = 0; i < n; i += 1) {
      const angle = w * i;
      re += centered[i] * Math.cos(angle);
      im -= centered[i] * Math.sin(angle);
    }
    const mag = Math.sqrt(re * re + im * im) / n;
    if (mag > bestMag) {
      bestMag = mag;
      bestK = k;
    }
  }

  return { hz: (bestK * fs) / n, magnitude: bestMag };
}

function parseSample(topic, payload) {
  const sensor = topic.includes('/A') || topic.endsWith('sensor1') ? 'A' : 'B';

  const x = Number.isFinite(payload.x)
    ? payload.x / 1000
    : Number.isFinite(payload.x_g)
      ? payload.x_g
      : null;

  const z = Number.isFinite(payload.z)
    ? payload.z / 1000
    : Number.isFinite(payload.z_g)
      ? payload.z_g
      : null;

  if (x === null || z === null) return null;

  return { sensor, x, z, ts: Date.now() };
}

function updateState(sample) {
  const s = state[sample.sensor];
  pushLimited(s.x, sample.x);
  pushLimited(s.z, sample.z);
  s.count += 1;
  s.lastTs = sample.ts;
}

function formatAxis(values) {
  const m = mean(values);
  const r = rms(values);
  const s = std(values, m);
  const p2p = ptp(values);
  const dom = dominantFrequency(values, SAMPLE_RATE_HZ);

  return {
    mean: m,
    rms: r,
    std: s,
    p2p,
    domHz: dom.hz,
    domMag: dom.magnitude
  };
}

function reportSensor(label, sensorState) {
  const n = Math.min(sensorState.x.length, sensorState.z.length);
  if (n < 16) {
    console.log(`[${label}] waiting for enough data... (${n}/${WINDOW_SIZE})`);
    return;
  }

  const fx = formatAxis(sensorState.x);
  const fz = formatAxis(sensorState.z);

  console.log(`\n[${label}] samples=${n} updates=${sensorState.count}`);
  console.log(
    `X: mean=${fx.mean.toFixed(4)}g rms=${fx.rms.toFixed(4)}g std=${fx.std.toFixed(4)}g p2p=${fx.p2p.toFixed(4)}g dom=${fx.domHz.toFixed(3)}Hz`
  );
  console.log(
    `Z: mean=${fz.mean.toFixed(4)}g rms=${fz.rms.toFixed(4)}g std=${fz.std.toFixed(4)}g p2p=${fz.p2p.toFixed(4)}g dom=${fz.domHz.toFixed(3)}Hz`
  );
}

const client = mqtt.connect({
  host: MQTT_HOST,
  port: MQTT_PORT,
  protocol: 'mqtts',
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  rejectUnauthorized: true
});

client.on('connect', () => {
  console.log('Realtime analyzer connected to MQTT.');
  console.log(`Window: ${WINDOW_SECONDS}s (${WINDOW_SIZE} samples), sample rate: ${SAMPLE_RATE_HZ}Hz`);
  client.subscribe(topics, (err) => {
    if (err) {
      console.error('Subscription failed:', err.message);
      process.exit(1);
    }
    console.log('Subscribed topics:', topics.join(', '));
  });
});

client.on('message', (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    const sample = parseSample(topic, payload);
    if (!sample) return;
    updateState(sample);
  } catch (error) {
    // Ignore malformed payloads and continue.
  }
});

client.on('error', (error) => {
  console.error('MQTT error:', error.message);
});

const timer = setInterval(() => {
  reportSensor('Sensor A', state.A);
  reportSensor('Sensor B', state.B);
}, REPORT_EVERY_MS);

function shutdown() {
  clearInterval(timer);
  client.end(true, () => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
