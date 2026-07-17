import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface VoltageData {
  x: number;
  y: number;
  z: number;
}

interface SensorSample {
  timestamp: number;
  x: number;
  y: number;
  z: number;
  voltage: VoltageData;
}

interface FFTPoint {
  frequency: number;
  magnitude: number;
}

interface FFTData {
  sensorA: {
    x: FFTPoint[];
    y: FFTPoint[];
    z: FFTPoint[];
  };
}

type AxisKey = 'x' | 'y' | 'z';
type ChartKind = 'time' | 'fft';

interface ExpandedChartState {
  kind: ChartKind;
  axis: AxisKey;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SENSOR_TOPIC = 'sensorlab/sensor1';
const VISIBLE_WINDOW = 80;
const MAX_POINTS = 1200;
const DEFAULT_VOLTAGE: VoltageData = { x: 1.65, y: 1.65, z: 1.65 };

const AXIS_CONFIG: Record<AxisKey, { label: string; color: string }> = {
  x: { label: 'X', color: '#06b6d4' },
  y: { label: 'Y', color: '#f59e0b' },
  z: { label: 'Z', color: '#22c55e' },
};

const getNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
};

const clampVoltage = (value: number): number => Math.max(0, Math.min(3.3, value));

const normalizeSample = (raw: unknown): SensorSample | null => {
  if (!raw || typeof raw !== 'object') return null;

  const source = raw as Record<string, unknown>;
  const voltageObj = source.voltage;
  const voltageSource =
    voltageObj && typeof voltageObj === 'object'
      ? (voltageObj as Record<string, unknown>)
      : null;

  const xMilliG = getNumber(source.x) ?? ((getNumber(source.x_g) ?? 0) * 1000);
  const yMilliG = getNumber(source.y) ?? ((getNumber(source.y_g) ?? 0) * 1000);
  const zMilliG = getNumber(source.z) ?? ((getNumber(source.z_g) ?? 0) * 1000);

  const voltageX = getNumber(voltageSource?.x) ?? getNumber(source.x_v) ?? DEFAULT_VOLTAGE.x;
  const voltageY = getNumber(voltageSource?.y) ?? getNumber(source.y_v) ?? DEFAULT_VOLTAGE.y;
  const voltageZ = getNumber(voltageSource?.z) ?? getNumber(source.z_v) ?? DEFAULT_VOLTAGE.z;

  return {
    timestamp: getNumber(source.timestamp) ?? Date.now(),
    x: xMilliG,
    y: yMilliG,
    z: zMilliG,
    voltage: {
      x: clampVoltage(voltageX),
      y: clampVoltage(voltageY),
      z: clampVoltage(voltageZ),
    },
  };
};

const pushSample = (prev: SensorSample[], next: SensorSample): SensorSample[] => {
  const merged = prev.concat(next);
  return merged.length > MAX_POINTS ? merged.slice(-MAX_POINTS) : merged;
};

const VoltageBar: React.FC<{ voltage: number; color: string }> = ({ voltage, color }) => {
  const percentage = (clampVoltage(voltage) / 3.3) * 100;

  return (
    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
      <div className="h-full transition-all duration-100" style={{ width: `${percentage}%`, backgroundColor: color }} />
    </div>
  );
};

const getTimeDomainY = (values: number[]): [number, number] => {
  if (values.length === 0) return [-0.5, 0.5];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const padded = Math.max(span * 1.3, 0.1);
  const center = (max + min) / 2;
  const half = padded / 2;
  return [center - half, center + half];
};

const getFftDomain = (values: number[]): [number, number] => {
  if (values.length === 0) return [0, 1];
  const max = Math.max(...values);
  return [0, Math.max(max * 1.1, 0.05)];
};

const SensorsLive: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [esp32Status, setEsp32Status] = useState<'online' | 'offline'>('offline');
  const [sensorData, setSensorData] = useState<SensorSample[]>([]);
  const [voltage, setVoltage] = useState<VoltageData>(DEFAULT_VOLTAGE);
  const [fft, setFft] = useState<FFTData | null>(null);
  const [expandedChart, setExpandedChart] = useState<ExpandedChartState | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const fftTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(`${API_URL}/mqtt/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => setConnected(true);

    eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'status') {
        setEsp32Status(message.esp32Status === 'online' ? 'online' : 'offline');
        return;
      }

      if (message.type === 'esp32_status') {
        setEsp32Status(message.status === 'online' ? 'online' : 'offline');
        return;
      }

      if (message.topic !== SENSOR_TOPIC || !message.data) return;

      const sample = normalizeSample(message.data);
      if (!sample) return;

      setVoltage(sample.voltage);
      setSensorData((prev) => pushSample(prev, sample));
    };

    eventSource.onerror = () => {
      setConnected(false);
      setEsp32Status('offline');
      eventSource.close();
    };

    const fetchFFT = async () => {
      try {
        const response = await fetch(`${API_URL}/mqtt/fft`);
        const json = await response.json();
        if (json.success && json.data?.sensorA) {
          setFft({ sensorA: json.data.sensorA });
        }
      } catch {
        // Ignore temporary polling errors.
      }
    };

    fetchFFT();
    fftTimerRef.current = window.setInterval(fetchFFT, 500);

    return () => {
      eventSource.close();
      if (fftTimerRef.current) {
        clearInterval(fftTimerRef.current);
      }
    };
  }, []);

  const chartData = useMemo(() => {
    const windowed = sensorData.slice(-VISIBLE_WINDOW);
    if (windowed.length === 0) return [];
    const t0 = windowed[0].timestamp;
    return windowed.map((s) => ({
      timeMs: s.timestamp - t0,
      x: s.x,
      y: s.y,
      z: s.z,
    }));
  }, [sensorData]);

  const axisTimeData = useMemo(() => {
    const toAxis = (axis: AxisKey) => chartData.map((p) => ({ timeMs: p.timeMs, value: p[axis] / 1000 }));
    return {
      x: toAxis('x'),
      y: toAxis('y'),
      z: toAxis('z'),
    };
  }, [chartData]);

  const mergeFftAxes = useMemo(() => {
    const merge = (axisKey: 'x' | 'y' | 'z'): FFTPoint[] => fft?.sensorA?.[axisKey] ?? [];
    return {
      x: merge('x'),
      y: merge('y'),
      z: merge('z'),
    };
  }, [fft]);

  const renderTimeChart = (axis: AxisKey, height: number) => {
    const axisCfg = AXIS_CONFIG[axis];
    const data = axisTimeData[axis];
    const yDomain = getTimeDomainY(data.map((p) => p.value));

    if (data.length < 2) {
      return <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">Waiting for {axisCfg.label} data...</div>;
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="timeMs"
            type="number"
            domain={['dataMin', 'dataMax']}
            stroke="#94a3b8"
            tickFormatter={(v) => `${(Number(v) / 1000).toFixed(1)}s`}
          />
          <YAxis domain={yDomain} stroke="#94a3b8" tickFormatter={(v) => `${Number(v).toFixed(3)}g`} />
          <Tooltip
            contentStyle={{ background: '#020617', border: '1px solid #334155' }}
            labelFormatter={(v) => `t=${(Number(v) / 1000).toFixed(3)}s`}
            formatter={(value: number) => [`${value.toFixed(5)} g`, axisCfg.label]}
          />
          <Line type="linear" dataKey="value" stroke={axisCfg.color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderFftChart = (axis: AxisKey, height: number) => {
    const axisCfg = AXIS_CONFIG[axis];
    const data = mergeFftAxes[axis];
    const yDomain = getFftDomain(data.map((p) => p.magnitude));

    if (data.length === 0) {
      return <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">Waiting for {axisCfg.label} FFT...</div>;
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="frequency" stroke="#94a3b8" tickFormatter={(v) => `${Number(v).toFixed(2)}Hz`} />
          <YAxis domain={yDomain} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ background: '#020617', border: '1px solid #334155' }}
            labelFormatter={(v) => `${Number(v).toFixed(3)} Hz`}
            formatter={(value: number) => [value.toFixed(6), `${axisCfg.label} magnitude`]}
          />
          <Line type="linear" dataKey="magnitude" stroke={axisCfg.color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg md:text-xl font-semibold">Sensors - Live Single Sensor (X/Y/Z)</h1>
          <div className="flex items-center gap-2">
            <Badge className={connected ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700/40 text-slate-300 border border-slate-600/40'}>
              Stream: {connected ? 'live' : 'offline'}
            </Badge>
            <Badge className={esp32Status === 'online' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'bg-orange-600/20 text-orange-300 border border-orange-500/30'}>
              ESP32: {esp32Status}
            </Badge>
          </div>
        </div>

        <Card className="bg-slate-900 border-cyan-900/40">
          <CardHeader>
            <CardTitle className="text-sm text-cyan-300">Topic: {SENSOR_TOPIC}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Analog Output (0-3.3V)</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-cyan-400">X</span>
                    <span className="font-mono text-slate-300">{voltage.x.toFixed(3)}V</span>
                  </div>
                  <VoltageBar voltage={voltage.x} color={AXIS_CONFIG.x.color} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-amber-400">Y</span>
                    <span className="font-mono text-slate-300">{voltage.y.toFixed(3)}V</span>
                  </div>
                  <VoltageBar voltage={voltage.y} color={AXIS_CONFIG.y.color} />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-emerald-400">Z</span>
                    <span className="font-mono text-slate-300">{voltage.z.toFixed(3)}V</span>
                  </div>
                  <VoltageBar voltage={voltage.z} color={AXIS_CONFIG.z.color} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {(['x', 'y', 'z'] as AxisKey[]).map((axis) => (
                <Card key={`time-${axis}`} className="bg-slate-900 border-slate-800 cursor-pointer" onClick={() => setExpandedChart({ kind: 'time', axis })}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm" style={{ color: AXIS_CONFIG[axis].color }}>
                      {AXIS_CONFIG[axis].label}-axis Time Domain
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    {renderTimeChart(axis, 220)}
                    <div className="text-[11px] text-slate-500 text-right mt-1">Click to enlarge</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-indigo-900/40">
          <CardHeader>
            <CardTitle className="text-sm text-indigo-300">Single Sensor FFT (X/Y/Z)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mergeFftAxes.x.length === 0 && mergeFftAxes.y.length === 0 && mergeFftAxes.z.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-slate-400">Waiting for enough data to compute FFT...</div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {(['x', 'y', 'z'] as AxisKey[]).map((axis) => (
                  <Card key={`fft-${axis}`} className="bg-slate-900 border-slate-800 cursor-pointer" onClick={() => setExpandedChart({ kind: 'fft', axis })}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm" style={{ color: AXIS_CONFIG[axis].color }}>
                        {AXIS_CONFIG[axis].label}-axis FFT
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3">
                      {renderFftChart(axis, 220)}
                      <div className="text-[11px] text-slate-500 text-right mt-1">Click to enlarge</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={expandedChart !== null} onOpenChange={(open) => { if (!open) setExpandedChart(null); }}>
          <DialogContent className="max-w-6xl w-[95vw] bg-slate-950 border-slate-700 text-slate-100">
            <DialogHeader>
              <DialogTitle>
                {expandedChart ? `${AXIS_CONFIG[expandedChart.axis].label}-axis ${expandedChart.kind === 'time' ? 'Time Domain' : 'FFT'} (Expanded)` : ''}
              </DialogTitle>
            </DialogHeader>
            <div className="h-[70vh]">
              {expandedChart && expandedChart.kind === 'time' && renderTimeChart(expandedChart.axis, 620)}
              {expandedChart && expandedChart.kind === 'fft' && renderFftChart(expandedChart.axis, 620)}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default SensorsLive;