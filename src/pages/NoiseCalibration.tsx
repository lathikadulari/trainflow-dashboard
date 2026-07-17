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
  RotateCcw, CheckCircle, Calendar, Sparkles, Zap, Clock 
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
