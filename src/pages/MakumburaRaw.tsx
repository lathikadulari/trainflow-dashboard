import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface SensorSample {
  timestamp: number;
  x: number;
  y: number;
  z: number;
}

interface FFTPoint {
  frequency: number;
  magnitude: number;
}

interface FFTData {
  sensorA: {
    x: FFTPoint[];
    z: FFTPoint[];
  };
}

const API_URL = 'http://localhost:5000/api';
const VISIBLE_WINDOW = 60;
const MAX_POINTS = 1200;

const MakumburaRaw: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [esp32Status, setEsp32Status] = useState<'online' | 'offline'>('offline');
  const [samples, setSamples] = useState<SensorSample[]>([]);
  const [fft, setFft] = useState<FFTData | null>(null);

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

      if (message.topic !== 'trainflow/sensor/A' || !message.data) return;

      setSamples((prev) => {
        const merged = prev.concat(message.data as SensorSample);
        return merged.length > MAX_POINTS ? merged.slice(-MAX_POINTS) : merged;
      });
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

  const timeData = useMemo(() => {
    const windowed = samples.slice(-VISIBLE_WINDOW);
    if (windowed.length === 0) return [];
    const t0 = windowed[0].timestamp;
    return windowed.map((s) => ({
      timeMs: s.timestamp - t0,
      x: s.x,
      z: s.z,
    }));
  }, [samples]);

  const fftData = useMemo(() => {
    const xData = fft?.sensorA?.x ?? [];
    const zData = fft?.sensorA?.z ?? [];
    const byFreq = new Map<number, { frequency: number; x?: number; z?: number }>();

    xData.forEach((p) => {
      byFreq.set(p.frequency, {
        ...(byFreq.get(p.frequency) ?? { frequency: p.frequency }),
        x: p.magnitude,
      });
    });

    zData.forEach((p) => {
      byFreq.set(p.frequency, {
        ...(byFreq.get(p.frequency) ?? { frequency: p.frequency }),
        z: p.magnitude,
      });
    });

    return Array.from(byFreq.values()).sort((a, b) => a.frequency - b.frequency);
  }, [fft]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg md:text-xl font-semibold">Makumbura Station Raw Sensor</h1>
          <div className="flex items-center gap-2">
            <Badge className={connected ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700/40 text-slate-300 border border-slate-600/40'}>
              Stream: {connected ? 'live' : 'offline'}
            </Badge>
            <Badge className={esp32Status === 'online' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'bg-orange-600/20 text-orange-300 border border-orange-500/30'}>
              ESP32: {esp32Status}
            </Badge>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm">Raw Sensor Plot (X and Z)</CardTitle>
          </CardHeader>
          <CardContent>
            {timeData.length < 2 ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-slate-400">Waiting for raw sensor data...</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="timeMs"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    stroke="#94a3b8"
                    tickFormatter={(v) => `${(Number(v) / 1000).toFixed(1)}s`}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tickFormatter={(v) => `${(Number(v) / 1000).toFixed(3)}g`}
                  />
                  <Tooltip
                    contentStyle={{ background: '#020617', border: '1px solid #334155' }}
                    labelFormatter={(v) => `t=${(Number(v) / 1000).toFixed(3)}s`}
                    formatter={(value: number, name: string) => [`${(value / 1000).toFixed(5)} g`, name.toUpperCase()]}
                  />
                  <Line type="linear" dataKey="x" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="z" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-sm">FFT Plot (X and Z)</CardTitle>
          </CardHeader>
          <CardContent>
            {fftData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-slate-400">Waiting for enough data to compute FFT...</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={fftData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="frequency" stroke="#94a3b8" tickFormatter={(v) => `${v}Hz`} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ background: '#020617', border: '1px solid #334155' }}
                    labelFormatter={(v) => `${v}Hz`}
                    formatter={(value: number | undefined, name: string) => [typeof value === 'number' ? value.toFixed(5) : '-', `${name.toUpperCase()} magnitude`]}
                  />
                  <Line type="linear" dataKey="x" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="z" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MakumburaRaw;
