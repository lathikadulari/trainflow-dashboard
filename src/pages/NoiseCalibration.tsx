import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CartesianGrid, Line, LineChart, Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { 
  Sliders, Activity, Download, Trash2, Play, Square, 
  RotateCcw, CheckCircle, Calendar, Sparkles, Zap, Clock,
  ArrowRight, Layers, Filter, Cpu, ShieldCheck, BarChart3, HelpCircle, Info
} from 'lucide-react';
import Header from '@/components/dashboard/Header';
import { toast } from 'sonner';

interface NoiseProfile {
  _id: string;
  station: string;
  sensorId: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  samplesCount: number;
  voltageFluctuations: {
    y: { min: number; max: number; mean: number; stdDev: number; vpp: number; rms: number };
    z: { min: number; max: number; mean: number; stdDev: number; vpp: number; rms: number };
  };
  accelerationNoise: {
    y: { min: number; max: number; mean: number; stdDev: number; vpp: number; rms: number };
    z: { min: number; max: number; mean: number; stdDev: number; vpp: number; rms: number };
  };
  dominantFrequencies: {
    y: number;
    z: number;
  };
  fftSpectrum?: {
    y: Array<{ frequency: number; magnitude: number }>;
    z: Array<{ frequency: number; magnitude: number }>;
  };
  notes: string;
  recordedAt: string;
  localTime: string;
}

interface VoltageData {
  x: number;
  y: number;
  z: number;
}

interface SensorSample {
  timestamp: number;
  y: number;
  z: number;
  voltage: VoltageData;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const LIVE_WINDOW_SIZE = 80;
const DEFAULT_VOLTAGE: VoltageData = { x: 1.65, y: 1.65, z: 1.65 };

const getNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
};

const clampVoltage = (value: number): number => Math.max(0, Math.min(3.3, value));

const normalizeSample = (raw: unknown): SensorSample | null => {
  if (!raw || typeof raw !== 'object') return null;

  const source = raw as Record<string, unknown>;

  const yMilliG =
    getNumber(source.y) ??
    ((getNumber(source.y_g) ?? getNumber(source.x_g) ?? 0) * 1000);
  const zMilliG =
    getNumber(source.z) ??
    ((getNumber(source.z_g) ?? 0) * 1000);

  const voltageObj = source.voltage;
  const voltageSource =
    voltageObj && typeof voltageObj === 'object'
      ? (voltageObj as Record<string, unknown>)
      : null;

  const voltageY =
    getNumber(voltageSource?.y) ?? getNumber(source.y_v) ?? getNumber(source.x_v) ?? DEFAULT_VOLTAGE.y;
  const voltageZ =
    getNumber(voltageSource?.z) ?? getNumber(source.z_v) ?? DEFAULT_VOLTAGE.z;

  return {
    timestamp: getNumber(source.timestamp) ?? Date.now(),
    y: yMilliG,
    z: zMilliG,
    voltage: {
      x: DEFAULT_VOLTAGE.x,
      y: clampVoltage(voltageY),
      z: clampVoltage(voltageZ),
    },
  };
};

// Interactive 60 FPS Canvas Video Demo Component
const NoiseCalibrationVideoDemo = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const TOTAL_DURATION = 28;

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      if (isPlaying) {
        setCurrentTime((prev) => {
          const next = prev + delta;
          return next >= TOTAL_DURATION ? 0 : next;
        });
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawVideoFrame(ctx, canvas.width, canvas.height, currentTime);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, currentTime]);

  const drawVideoFrame = (ctx: CanvasRenderingContext2D, width: number, height: number, t: number) => {
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, width, 45);
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(0, 45);
    ctx.lineTo(width, 45);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('NOISE DATA CALIBRATION — ANIMATED DEMO', 20, 28);

    const timeStr = `00:${Math.floor(t).toString().padStart(2, '0')} / 00:28`;
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(timeStr, width - 130, 28);

    if (t < 8) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('STEP 1: Stationary Sensor Installation & Baseline', 30, 85);

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(40, 110, 320, 260, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('ESP32 Accelerometer Mount', 60, 145);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('STATUS: STILL (a = 0.000g)', 60, 180);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px sans-serif';
      ctx.fillText('Captures background thermal &', 60, 220);
      ctx.fillText('electrical jitter without motion.', 60, 240);

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(390, 110, 370, 260, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('Dual Axis Y/Z Ambient Waveforms', 410, 140);

      ctx.strokeStyle = '#ef4444';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(410, 180);
      ctx.lineTo(740, 180);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(410, 300);
      ctx.lineTo(740, 300);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ef4444';
      ctx.font = '11px monospace';
      ctx.fillText('+0.002g Ambient Limit', 610, 175);
      ctx.fillText('-0.002g Ambient Limit', 610, 315);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < 330; x += 5) {
        const y = 240 + Math.sin(x * 0.05 + t * 5) * 15 + (Math.random() - 0.5) * 4;
        if (x === 0) ctx.moveTo(410 + x, y);
        else ctx.lineTo(410 + x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < 330; x += 5) {
        const y = 240 + Math.cos(x * 0.05 + t * 4) * 12 + (Math.random() - 0.5) * 4;
        if (x === 0) ctx.moveTo(410 + x, y);
        else ctx.lineTo(410 + x, y);
      }
      ctx.stroke();

    } else if (t < 13) {
      ctx.fillStyle = '#60a5fa';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('STEP 2: High-Speed 50Hz Data Stream Sampling', 30, 85);

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(40, 110, 320, 260, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#60a5fa';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('ESP32 MQTT Payload Stream', 60, 145);

      ctx.fillStyle = '#a7f3d0';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('Topic: trainflow/sensor/A', 60, 180);
      ctx.fillText('Interval: ~20ms (50Hz)', 60, 205);

      ctx.fillStyle = '#f8fafc';
      ctx.fillText('{', 60, 240);
      ctx.fillText(`  "y_v": ${(1.650 + Math.sin(t*10)*0.012).toFixed(3)}V,`, 60, 265);
      ctx.fillText(`  "z_v": ${(1.650 - Math.cos(t*10)*0.009).toFixed(3)}V`, 60, 290);
      ctx.fillText('}', 60, 315);

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(390, 110, 370, 260, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#60a5fa';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('Continuous 1.650V ADC Jitter Stream', 410, 140);

      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let x = 0; x < 330; x += 5) {
        const y = 240 + Math.sin(x * 0.08 + t * 15) * 20 + Math.cos(x * 0.2) * 8;
        if (x === 0) ctx.moveTo(410 + x, y);
        else ctx.lineTo(410 + x, y);
      }
      ctx.stroke();

    } else if (t < 18) {
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('STEP 3: Parallel Statistical Mathematics Engine', 30, 85);

      const stats = [
        { title: '1. Mean Offset (μ)', val: '0.0010 g', desc: 'Zero DC Bias', col: '#38bdf8' },
        { title: '2. Standard Deviation (σ)', val: '0.0018 g', desc: 'Noise Floor Band', col: '#34d399' },
        { title: '3. Peak-to-Peak (Vpp)', val: '0.0080 g', desc: 'Max Spike Span', col: '#a78bfa' },
        { title: '4. RMS Energy', val: '0.0020 g', desc: 'Total Noise Power', col: '#fbbf24' }
      ];

      stats.forEach((s, i) => {
        const ypos = 110 + i * 65;
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = s.col;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(40, ypos, 720, 52, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = s.col;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(s.title, 60, ypos + 32);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(s.val, 400, ypos + 32);

        ctx.fillStyle = s.col;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(s.desc, 610, ypos + 32);
      });

    } else if (t < 23) {
      ctx.fillStyle = '#c084fc';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('STEP 4: Fast Fourier Transform (FFT) Spectral Analysis', 30, 85);

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(40, 110, 720, 260, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#c084fc';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('FFT Frequency Spectrum |X(f)|', 60, 140);

      const freqs = [
        { label: '5Hz', h: 30, col: '#38bdf8' },
        { label: '12.5Hz (Motor)', h: 120, col: '#a78bfa' },
        { label: '25Hz', h: 40, col: '#38bdf8' },
        { label: '35Hz', h: 35, col: '#38bdf8' },
        { label: '50Hz (Power Line)', h: 180, col: '#ef4444' },
        { label: '65Hz', h: 25, col: '#38bdf8' },
        { label: '80Hz', h: 20, col: '#38bdf8' }
      ];

      freqs.forEach((f, i) => {
        const x = 90 + i * 95;
        const y = 330 - f.h;

        ctx.fillStyle = f.col;
        ctx.beginPath();
        ctx.roundRect(x, y, 40, f.h, [4, 4, 0, 0]);
        ctx.fill();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.fillText(f.label, x - 10, 350);
      });

    } else {
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('STEP 5: Dynamic 3-Sigma Noise Gate Filter Output', 30, 85);

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(40, 110, 330, 260, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('1. Input Signal + Thresholds', 60, 140);

      ctx.strokeStyle = '#ef4444';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(60, 180);
      ctx.lineTo(350, 180);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(60, 300);
      ctx.lineTo(350, 300);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ef4444';
      ctx.font = '11px sans-serif';
      ctx.fillText('+3σ Limit', 290, 175);
      ctx.fillText('-3σ Limit', 290, 315);

      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(60, 240);
      ctx.lineTo(150, 240);
      ctx.lineTo(170, 130);
      ctx.lineTo(190, 340);
      ctx.lineTo(210, 240);
      ctx.lineTo(350, 240);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(430, 110, 330, 260, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('2. Calibrated Clean Output', 450, 140);

      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(450, 240);
      ctx.lineTo(740, 240);
      ctx.stroke();

      ctx.fillStyle = '#a7f3d0';
      ctx.font = '11px sans-serif';
      ctx.fillText('0.000g Flat Baseline', 450, 230);

      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(450, 240);
      ctx.lineTo(540, 240);
      ctx.lineTo(560, 140);
      ctx.lineTo(580, 320);
      ctx.lineTo(600, 240);
      ctx.lineTo(740, 240);
      ctx.stroke();
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden border border-cyan-500/30 bg-black shadow-2xl group">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={450} 
          className="w-full h-auto aspect-video object-cover rounded-xl"
        />
        
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent flex items-center justify-between gap-3">
          <Button
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 shrink-0"
          >
            {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4 fill-cyan-300" />}
            <span className="ml-1.5 text-xs font-bold">{isPlaying ? 'Pause' : 'Play'}</span>
          </Button>

          <input
            type="range"
            min={0}
            max={TOTAL_DURATION}
            step={0.1}
            value={currentTime}
            onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />

          <span className="text-xs font-mono text-cyan-300 shrink-0 font-bold">
            00:{Math.floor(currentTime).toString().padStart(2, '0')} / 00:28
          </span>

          <Button
            size="sm"
            variant="outline"
            onClick={() => { setCurrentTime(0); setIsPlaying(true); }}
            className="bg-slate-900 border-slate-700 text-xs text-slate-300 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300 space-y-2">
        <div className="font-bold text-slate-200 flex items-center justify-between">
          <span className="flex items-center gap-1.5"><Info className="w-4 h-4 text-cyan-400" /> Interactive Scene Highlights (Click to Jump):</span>
          <span className="text-[10px] text-cyan-400 font-mono">60 FPS Render</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
          {[
            { label: '0s-8s: Baseline', time: 0 },
            { label: '8s-13s: 50Hz Stream', time: 8 },
            { label: '13s-18s: Math Engine', time: 13 },
            { label: '18s-23s: FFT Spectrum', time: 18 },
            { label: '23s-28s: 3σ Gate Filter', time: 23 }
          ].map((sc) => (
            <button
              key={sc.time}
              onClick={() => { setCurrentTime(sc.time); setIsPlaying(true); }}
              className={`p-1.5 text-[11px] font-semibold rounded-lg border text-left transition-all ${
                currentTime >= sc.time && currentTime < sc.time + 5
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              • {sc.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const NoiseCalibration: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [esp32Status, setEsp32Status] = useState<'online' | 'offline'>('offline');
  const [selectedSensor, setSelectedSensor] = useState<'sensor2' | 'sensor1'>('sensor2'); // sensor2 is Left, sensor1 is Right
  const [selectedDuration, setSelectedDuration] = useState<'5' | '10' | '30' | '60' | 'manual'>('10');
  
  // Real-time chart buffer
  const [liveData, setLiveData] = useState<SensorSample[]>([]);
  
  // Calibration State
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibStartTime, setCalibStartTime] = useState<Date | null>(null);
  const [calibElapsedTime, setCalibElapsedTime] = useState(0);
  const [notes, setNotes] = useState('');
  
  // Results & History
  const [activeProfile, setActiveProfile] = useState<NoiseProfile | null>(null);
  const [profiles, setProfiles] = useState<NoiseProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [calibSaving, setCalibSaving] = useState(false);

  // Diagram view state
  const [diagramTab, setDiagramTab] = useState<'pipeline' | 'gaussian' | 'signal'>('pipeline');
  const [activeStep, setActiveStep] = useState<number>(1);

  const eventSourceRef = useRef<EventSource | null>(null);
  const calibrationTimerRef = useRef<number | null>(null);
  const liveDataRef = useRef<SensorSample[]>([]);

  // Fetch past profiles
  const fetchProfiles = useCallback(async () => {
    setProfilesLoading(true);
    try {
      const res = await fetch(`${API_URL}/noise/profiles`);
      const data = await res.json();
      if (data.success) {
        setProfiles(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch noise profiles:', err);
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Connect to the real-time SSE stream
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

      if (!message.data) return;

      // Map topics to sensors
      // Left Sensor = sensor2 (topic: trainflow/sensor/A)
      // Right Sensor = sensor1 (topic: trainflow/sensor/B)
      const isTargetSensor = 
        (selectedSensor === 'sensor2' && message.topic === 'trainflow/sensor/A') ||
        (selectedSensor === 'sensor1' && message.topic === 'trainflow/sensor/B');

      if (isTargetSensor) {
        const sample = normalizeSample(message.data);
        if (!sample) return;

        const updated = [...liveDataRef.current, sample];
        const sliced = updated.length > LIVE_WINDOW_SIZE ? updated.slice(-LIVE_WINDOW_SIZE) : updated;
        liveDataRef.current = sliced;
        setLiveData(sliced);
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      setEsp32Status('offline');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [selectedSensor]);

  // Start Calibration
  const startCalibration = () => {
    if (esp32Status !== 'online') {
      toast.error('Cannot start calibration: ESP32 is offline');
      return;
    }
    
    setIsCalibrating(true);
    setActiveProfile(null);
    const start = new Date();
    setCalibStartTime(start);
    setCalibElapsedTime(0);
    liveDataRef.current = []; // Clear graph buffer
    setLiveData([]);

    toast.info('Calibration started. Please keep the sensor perfectly idle!');

    if (selectedDuration !== 'manual') {
      const targetSec = parseInt(selectedDuration);
      
      let elapsed = 0;
      calibrationTimerRef.current = window.setInterval(() => {
        elapsed += 1;
        setCalibElapsedTime(elapsed);

        if (elapsed >= targetSec) {
          stopCalibration(start, new Date());
        }
      }, 1000);
    } else {
      // Manual mode timer
      let elapsed = 0;
      calibrationTimerRef.current = window.setInterval(() => {
        elapsed += 1;
        setCalibElapsedTime(elapsed);
      }, 1000);
    }
  };

  // Stop Calibration
  const stopCalibration = async (startTimeObj?: Date, endTimeObj?: Date) => {
    if (calibrationTimerRef.current) {
      clearInterval(calibrationTimerRef.current);
    }
    
    setIsCalibrating(false);
    setCalibSaving(true);

    const start = startTimeObj || calibStartTime || new Date();
    const end = endTimeObj || new Date();

    try {
      const response = await fetch(`${API_URL}/noise/calibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station: 'Makumbura',
          sensorId: selectedSensor,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          notes: notes
        })
      });

      const result = await response.json();
      if (result.success) {
        setActiveProfile(result.data);
        toast.success('Sensor noise profiling calibration completed successfully!');
        fetchProfiles();
      } else {
        toast.error(result.message || 'Calibration analysis failed.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error during calibration profiling.');
    } finally {
      setCalibSaving(false);
    }
  };

  // Delete profile
  const deleteProfile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this noise profile?')) return;
    try {
      const res = await fetch(`${API_URL}/noise/profiles/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Noise profile deleted.');
        if (activeProfile?._id === id) setActiveProfile(null);
        fetchProfiles();
      } else {
        toast.error('Failed to delete profile.');
      }
    } catch (err) {
      toast.error('Error deleting profile.');
    }
  };

  // Live Chart Data Preparation
  const chartData = useMemo(() => {
    if (liveData.length === 0) return [];
    const t0 = liveData[0].timestamp;
    return liveData.map((d) => ({
      timeMs: d.timestamp - t0,
      timeSec: ((d.timestamp - t0) / 1000).toFixed(1),
      y_v: d.voltage.y,
      z_v: d.voltage.z,
      y_g: d.y / 1000,
      z_g: d.z / 1000
    }));
  }, [liveData]);

  // Format date helper
  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleString('en-GB', {
        timeZone: 'Asia/Colombo',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Banner Title */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Sensor Noise Calibration
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Capture baseline background noise and voltage deviations to calibrate filter software thresholds.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={connected ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700/40 text-slate-300 border border-slate-600/40'}>
              SSE Stream: {connected ? 'live' : 'offline'}
            </Badge>
            <Badge className={esp32Status === 'online' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'bg-orange-600/20 text-orange-300 border border-orange-500/30'}>
              ESP32: {esp32Status}
            </Badge>
          </div>
        </div>

        {/* Single-Page Unified Noise Calibration Process Guide & Demo Video */}
        <Card className="bg-slate-900/90 border-cyan-500/30 backdrop-blur-md overflow-hidden shadow-2xl">
          <CardHeader className="border-b border-slate-800/80 bg-slate-950/60 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Play className="w-5 h-5 fill-cyan-400 text-cyan-400" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                  Noise Calibration Visual Guide & Demo Video
                </CardTitle>
                <p className="text-xs text-slate-400">Everything you need to understand baseline noise profiling and filter thresholds in one simple view</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              
              {/* LEFT COLUMN: 60 FPS Canvas Video Demo Player */}
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-cyan-400">
                  <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-cyan-400" /> 1080p Animated Process Demo Video</span>
                  <span className="text-[10px] bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30 font-mono">Interactive Render</span>
                </div>

                <NoiseCalibrationVideoDemo />
              </div>

              {/* RIGHT COLUMN: All-in-One Visual Process Flow Diagram */}
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                  <span className="flex items-center gap-1.5"><Layers className="w-4 h-4 text-emerald-400" /> All-in-One Calibration Signal Pipeline</span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">End-to-End Diagram</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 shadow-xl">
                  <svg viewBox="0 0 550 420" className="w-full h-auto">
                    {/* STEP 1: Idle Setup */}
                    <g transform="translate(10, 10)">
                      <rect x="0" y="0" width="530" height="65" fill="#0f172a" rx="8" stroke="#38bdf8" strokeWidth="1.5" />
                      <circle cx="25" cy="32" r="12" fill="#0284c7" />
                      <text x="25" y="36" fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold">1</text>
                      <text x="48" y="26" fill="#38bdf8" fontSize="11" fontWeight="bold">1. Stationary Physical Sensor Setup</text>
                      <text x="48" y="44" fill="#cbd5e1" fontSize="9">Sensor resting still on track mount (a = 0.000g). Captures thermal noise (±0.002g).</text>
                      
                      {/* Mini wave */}
                      <path d="M 430,32 Q 450,22 470,32 T 510,32" fill="none" stroke="#38bdf8" strokeWidth="2" />
                    </g>

                    {/* Arrow 1 */}
                    <path d="M 275,75 L 275,90" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 3" />
                    <polygon points="271,88 275,98 279,88" fill="#38bdf8" />

                    {/* STEP 2: 50Hz Stream Sampling */}
                    <g transform="translate(10, 95)">
                      <rect x="0" y="0" width="530" height="65" fill="#0f172a" rx="8" stroke="#60a5fa" strokeWidth="1.5" />
                      <circle cx="25" cy="32" r="12" fill="#2563eb" />
                      <text x="25" y="36" fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold">2</text>
                      <text x="48" y="26" fill="#60a5fa" fontSize="11" fontWeight="bold">2. High-Speed 50Hz Data Stream</text>
                      <text x="48" y="44" fill="#cbd5e1" fontSize="9">ESP32 ADC voltage payload stream (1.650V reference) normalized to g-force.</text>
                      
                      {/* Mini wave */}
                      <path d="M 430,32 L 450,20 L 470,44 L 490,24 L 510,32" fill="none" stroke="#60a5fa" strokeWidth="2" />
                    </g>

                    {/* Arrow 2 */}
                    <path d="M 275,160 L 275,175" stroke="#60a5fa" strokeWidth="2" strokeDasharray="3 3" />
                    <polygon points="271,173 275,183 279,173" fill="#60a5fa" />

                    {/* STEP 3: Statistical Math Engine */}
                    <g transform="translate(10, 180)">
                      <rect x="0" y="0" width="530" height="65" fill="#0f172a" rx="8" stroke="#34d399" strokeWidth="1.5" />
                      <circle cx="25" cy="32" r="12" fill="#059669" />
                      <text x="25" y="36" fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold">3</text>
                      <text x="48" y="26" fill="#34d399" fontSize="11" fontWeight="bold">3. Statistical Mathematics Engine (μ, σ, Vpp, RMS)</text>
                      <text x="48" y="44" fill="#cbd5e1" fontSize="9">Calculates Mean offset (μ = 0.001g) & Noise Floor Standard Deviation (σ = 0.0018g).</text>
                      
                      {/* Math Chip */}
                      <rect x="430" y="18" width="85" height="28" fill="#064e3b" rx="4" stroke="#34d399" strokeWidth="1" />
                      <text x="472" y="35" fill="#a7f3d0" fontSize="9" textAnchor="middle" fontWeight="bold">μ & σ Profiling</text>
                    </g>

                    {/* Arrow 3 */}
                    <path d="M 275,245 L 275,260" stroke="#34d399" strokeWidth="2" strokeDasharray="3 3" />
                    <polygon points="271,258 275,268 279,258" fill="#34d399" />

                    {/* STEP 4: FFT Spectral Analysis */}
                    <g transform="translate(10, 265)">
                      <rect x="0" y="0" width="530" height="65" fill="#0f172a" rx="8" stroke="#c084fc" strokeWidth="1.5" />
                      <circle cx="25" cy="32" r="12" fill="#7c3aed" />
                      <text x="25" y="36" fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold">4</text>
                      <text x="48" y="26" fill="#c084fc" fontSize="11" fontWeight="bold">4. Spectral FFT Analysis (Time → Frequency)</text>
                      <text x="48" y="44" fill="#cbd5e1" fontSize="9">Fast Fourier Transform isolates 50Hz power line hum & 12.5Hz motor noise peaks.</text>
                      
                      {/* Mini Bars */}
                      <rect x="440" y="25" width="8" height="20" fill="#a78bfa" />
                      <rect x="465" y="15" width="10" height="30" fill="#ef4444" />
                      <rect x="490" y="30" width="8" height="15" fill="#a78bfa" />
                    </g>

                    {/* Arrow 4 */}
                    <path d="M 275,330 L 275,345" stroke="#c084fc" strokeWidth="2" strokeDasharray="3 3" />
                    <polygon points="271,343 275,353 279,343" fill="#c084fc" />

                    {/* STEP 5: Dynamic 3-Sigma Noise Gate Output */}
                    <g transform="translate(10, 350)">
                      <rect x="0" y="0" width="530" height="65" fill="#064e3b" rx="8" stroke="#34d399" strokeWidth="2" />
                      <circle cx="25" cy="32" r="12" fill="#10b981" />
                      <text x="25" y="36" fill="#ffffff" fontSize="11" textAnchor="middle" fontWeight="bold">5</text>
                      <text x="48" y="26" fill="#a7f3d0" fontSize="11" fontWeight="bold">5. Dynamic 3-Sigma Noise Gate Filter Output</text>
                      <text x="48" y="44" fill="#ecfdf5" fontSize="9">Noise floor within ±3σ clamped to 0.00g; authentic train passage impulses isolated!</text>
                      
                      {/* Clean wave */}
                      <path d="M 430,42 L 460,42 L 470,18 L 480,52 L 490,42 L 510,42" fill="none" stroke="#34d399" strokeWidth="2.5" />
                    </g>
                  </svg>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Panel */}
          <Card className="bg-slate-900 border-slate-800/80 backdrop-blur-sm lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                Calibration Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-400 block">Select Active Sensor</Label>
                <Select value={selectedSensor} onValueChange={(val: any) => setSelectedSensor(val)} disabled={isCalibrating}>
                  <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="sensor2">Left Sensor (sensor2 / A)</SelectItem>
                    <SelectItem value="sensor1">Right Sensor (sensor1 / B)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-400 block">Capture Duration</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['5', '10', '30', '60', 'manual'] as const).map((dur) => (
                    <button
                      key={dur}
                      disabled={isCalibrating}
                      onClick={() => setSelectedDuration(dur)}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        selectedDuration === dur
                          ? 'bg-cyan-500/10 border-cyan-400/50 text-cyan-300'
                          : 'bg-slate-800/40 border-slate-700/30 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {dur === 'manual' ? 'Man.' : `${dur}s`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-400 block">Calibration Notes / Location</Label>
                <Input
                  placeholder="e.g. Concrete block, 2:30pm calibration"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isCalibrating}
                  className="bg-slate-800/60 border-slate-700/50 text-slate-200"
                />
              </div>

              <div className="pt-2">
                {isCalibrating ? (
                  <Button
                    onClick={() => stopCalibration()}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold flex items-center justify-center gap-2 py-5"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    Stop & Analyze Calibration
                  </Button>
                ) : (
                  <Button
                    onClick={startCalibration}
                    disabled={esp32Status !== 'online' || calibSaving}
                    className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-extrabold flex items-center justify-center gap-2 py-5 shadow-lg shadow-cyan-900/30 hover:scale-[1.01] transition-all"
                  >
                    {calibSaving ? (
                      <>Analyzing Calibration Data...</>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-slate-950 text-slate-950" />
                        Start Noise Calibration
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Progress indicator */}
              {isCalibrating && (
                <div className="p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20 text-center space-y-2 animate-pulse">
                  <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider">CALIBRATING BASELINE...</div>
                  <div className="text-3xl font-mono font-bold text-slate-100">
                    {calibElapsedTime}s 
                    {selectedDuration !== 'manual' && ` / ${selectedDuration}s`}
                  </div>
                  <div className="text-[11px] text-slate-400">Keep sensor completely still to catch exact noise floors.</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Waveform Live Feed */}
          <Card className="bg-slate-900 border-slate-800/80 backdrop-blur-sm lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 font-medium flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-200">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Live Sensor Waveform (Y / Z)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Sample Rate ~50Hz
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {chartData.length < 2 ? (
                <div className="h-[260px] flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
                  <RotateCcw className="w-6 h-6 animate-spin text-slate-600" />
                  Waiting for live MQTT stream data...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Voltage graph */}
                  <div className="space-y-1">
                    <div className="text-[10px] text-slate-400 px-1 font-semibold uppercase tracking-wide">Analog Voltage (V)</div>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="timeSec" stroke="#475569" fontSize={9} />
                        <YAxis stroke="#475569" fontSize={9} domain={[1.5, 1.8]} />
                        <Tooltip contentStyle={{ background: '#090d16', border: '1px solid #1e293b' }} />
                        <Line type="linear" dataKey="y_v" stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        <Line type="linear" dataKey="z_v" stroke="#10b981" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Acceleration graph */}
                  <div className="space-y-1">
                    <div className="text-[10px] text-slate-400 px-1 font-semibold uppercase tracking-wide">Acceleration (g)</div>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="timeSec" stroke="#475569" fontSize={9} />
                        <YAxis stroke="#475569" fontSize={9} domain={[-1.5, 1.5]} />
                        <Tooltip contentStyle={{ background: '#090d16', border: '1px solid #1e293b' }} />
                        <Line type="linear" dataKey="y_g" stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        <Line type="linear" dataKey="z_g" stroke="#10b981" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Calibration Result (Current Run / Selected Profile) */}
        {(activeProfile) && (
          <Card className="bg-slate-900 border-cyan-900/30 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-3 flex gap-2">
              <a 
                href={`${API_URL}/noise/profiles/${activeProfile._id}/download`}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Download JSON
              </a>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => deleteProfile(activeProfile._id)} 
                className="h-8"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Profile
              </Button>
            </div>
            <CardHeader className="border-b border-slate-800/60 bg-slate-900/80">
              <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Calibration Results: {activeProfile.sensorId === 'sensor2' ? 'Left Sensor (A)' : 'Right Sensor (B)'}
                <span className="text-xs text-slate-500 font-normal ml-2">
                  Recorded: {formatDate(activeProfile.recordedAt)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              {/* Primary Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                {/* Duration */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" /> Duration & Count
                  </div>
                  <div className="text-xl font-bold mt-1 text-slate-100">{activeProfile.durationSeconds}s</div>
                  <div className="text-xs text-slate-400 mt-0.5">{activeProfile.samplesCount} samples recorded</div>
                </div>

                {/* Voltage Noise Standard Deviation */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-blue-400" /> Volt Std Dev (RMS Noise)
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <span className="text-[10px] text-blue-400">Y:</span> 
                      <span className="text-sm font-bold text-slate-100 font-mono ml-1">{(activeProfile.voltageFluctuations.y.stdDev * 1000).toFixed(2)}mV</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-400">Z:</span>
                      <span className="text-sm font-bold text-slate-100 font-mono ml-1">{(activeProfile.voltageFluctuations.z.stdDev * 1000).toFixed(2)}mV</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Peak-to-Peak: Y={(activeProfile.voltageFluctuations.y.vpp * 1000).toFixed(0)}mV | Z={(activeProfile.voltageFluctuations.z.vpp * 1000).toFixed(0)}mV</div>
                </div>

                {/* Accel Noise Standard Deviation */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" /> Accel Std Dev (Vibe Floor)
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <span className="text-[10px] text-blue-400">Y:</span> 
                      <span className="text-sm font-bold text-slate-100 font-mono ml-1">{activeProfile.accelerationNoise.y.stdDev.toFixed(5)}g</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-400">Z:</span>
                      <span className="text-sm font-bold text-slate-100 font-mono ml-1">{activeProfile.accelerationNoise.z.stdDev.toFixed(5)}g</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">RMS Offset: Y={activeProfile.accelerationNoise.y.rms.toFixed(3)}g | Z={activeProfile.accelerationNoise.z.rms.toFixed(3)}g</div>
                </div>

                {/* Dominant Noise Frequency */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-purple-400" /> Dom. Noise Frequencies
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <span className="text-[10px] text-blue-400">Y:</span> 
                      <span className="text-sm font-bold text-slate-100 font-mono ml-1">{activeProfile.dominantFrequencies.y.toFixed(2)}Hz</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-400">Z:</span>
                      <span className="text-sm font-bold text-slate-100 font-mono ml-1">{activeProfile.dominantFrequencies.z.toFixed(2)}Hz</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">FFT dominant environmental hum</div>
                </div>

              </div>

              {/* Recommended Filter Values */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  Recommended Software Filter Configuration
                </div>
                <div className="text-xs text-slate-400 leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 bg-slate-900/30 p-3 rounded border border-slate-800/40">
                    <div className="font-semibold text-slate-300">Vibration Filter (g-force threshold)</div>
                    <p>To eliminate idle environmental vibrations, use a threshold of <strong>3-sigma (3&sigma;)</strong> of background noise:</p>
                    <div className="font-mono text-cyan-400 font-bold mt-1 text-sm">
                      Y Threshold: &plusmn; {(activeProfile.accelerationNoise.y.stdDev * 3).toFixed(4)} g | 
                      Z Threshold: &plusmn; {(activeProfile.accelerationNoise.z.stdDev * 3).toFixed(4)} g
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Subtract average offset (Mean: Y={activeProfile.accelerationNoise.y.mean.toFixed(4)}g, Z={activeProfile.accelerationNoise.z.mean.toFixed(4)}g) before filter comparison.</p>
                  </div>
                  <div className="space-y-1 bg-slate-900/30 p-3 rounded border border-slate-800/40">
                    <div className="font-semibold text-slate-300">Dominant Noise Frequencies</div>
                    <p>If you implement a notch/bandstop filter to remove continuous motor/power hum, target these bands:</p>
                    <div className="font-mono text-purple-400 font-bold mt-1 text-sm">
                      Y Notch: {activeProfile.dominantFrequencies.y.toFixed(2)} Hz (&plusmn;0.5Hz) | 
                      Z Notch: {activeProfile.dominantFrequencies.z.toFixed(2)} Hz (&plusmn;0.5Hz)
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Avoid trigger detection rules inside these specific frequency components.</p>
                  </div>
                </div>
              </div>

              {/* FFT Chart Panel */}
              {activeProfile.fftSpectrum && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Y Axis FFT */}
                  <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                    <div className="text-xs font-semibold text-blue-400">Y-Axis FFT Noise Spectrum</div>
                    {activeProfile.fftSpectrum.y && activeProfile.fftSpectrum.y.length > 0 ? (
                      <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={activeProfile.fftSpectrum.y}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                          <XAxis dataKey="frequency" stroke="#475569" fontSize={9} tickFormatter={(v) => `${v.toFixed(1)}Hz`} />
                          <YAxis stroke="#475569" fontSize={9} />
                          <Tooltip contentStyle={{ background: '#090d16', border: '1px solid #1e293b' }} />
                          <Area type="monotone" dataKey="magnitude" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[160px] flex items-center justify-center text-xs text-slate-500">No FFT spectrum calculated</div>
                    )}
                  </div>
                  {/* Z Axis FFT */}
                  <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
                    <div className="text-xs font-semibold text-emerald-400">Z-Axis FFT Noise Spectrum</div>
                    {activeProfile.fftSpectrum.z && activeProfile.fftSpectrum.z.length > 0 ? (
                      <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={activeProfile.fftSpectrum.z}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                          <XAxis dataKey="frequency" stroke="#475569" fontSize={9} tickFormatter={(v) => `${v.toFixed(1)}Hz`} />
                          <YAxis stroke="#475569" fontSize={9} />
                          <Tooltip contentStyle={{ background: '#090d16', border: '1px solid #1e293b' }} />
                          <Area type="monotone" dataKey="magnitude" stroke="#10b981" fill="#10b981" fillOpacity={0.25} isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[160px] flex items-center justify-center text-xs text-slate-500">No FFT spectrum calculated</div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* History List */}
        <Card className="bg-slate-900 border-slate-800/80">
          <CardHeader>
            <CardTitle className="text-base text-slate-200 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              Calibration History
              {profiles.length > 0 && (
                <span className="text-xs bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full font-normal">
                  {profiles.length} profiles
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {profilesLoading ? (
              <div className="py-12 flex items-center justify-center text-slate-400 gap-2">
                <RotateCcw className="w-5 h-5 animate-spin" /> Fetching historical calibrations...
              </div>
            ) : profiles.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                No past noise calibrations found. Start a calibration run above to create one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                  <thead className="text-xs uppercase bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3">Sensor</th>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Duration (s)</th>
                      <th className="px-6 py-3">Volt Std Dev (Y/Z)</th>
                      <th className="px-6 py-3">Accel Noise Std Dev (Y/Z)</th>
                      <th className="px-6 py-3">Dominant Freq (Y/Z)</th>
                      <th className="px-6 py-3">Notes</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((profile) => (
                      <tr 
                        key={profile._id} 
                        onClick={() => setActiveProfile(profile)}
                        className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer ${
                          activeProfile?._id === profile._id ? 'bg-cyan-500/5 hover:bg-cyan-500/10' : ''
                        }`}
                      >
                        <td className="px-6 py-4 font-semibold text-slate-200">
                          {profile.sensorId === 'sensor2' ? 'Left Sensor' : 'Right Sensor'}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">{formatDate(profile.recordedAt)}</td>
                        <td className="px-6 py-4">{profile.durationSeconds}s</td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {(profile.voltageFluctuations.y.stdDev * 1000).toFixed(1)} / 
                          {(profile.voltageFluctuations.z.stdDev * 1000).toFixed(1)} mV
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {profile.accelerationNoise.y.stdDev.toFixed(4)} / 
                          {profile.accelerationNoise.z.stdDev.toFixed(4)} g
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {profile.dominantFrequencies.y.toFixed(1)} / 
                          {profile.dominantFrequencies.z.toFixed(1)} Hz
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400 max-w-[150px] truncate" title={profile.notes}>
                          {profile.notes || '—'}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                          <a 
                            href={`${API_URL}/noise/profiles/${profile._id}/download`}
                            className="inline-flex items-center justify-center p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Download JSON"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => deleteProfile(profile._id)}
                            className="inline-flex items-center justify-center p-1.5 rounded bg-red-650/15 hover:bg-red-600/30 text-red-400 hover:text-red-300 transition-colors"
                            title="Delete profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default NoiseCalibration;
