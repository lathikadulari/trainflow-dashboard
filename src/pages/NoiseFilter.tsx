import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CartesianGrid, Line, LineChart, Area, AreaChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend
} from 'recharts';
import { format, endOfDay } from 'date-fns';
import {
  ArrowLeft, Activity, Loader2, Download, Sliders, Zap, Filter,
  Waves, BarChart3, TrendingDown, TrendingUp, Sparkles,
  RefreshCw, CheckCircle, ArrowRightLeft, Save, Database
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── Types ───────────────────────────────────────────────────
interface TrainEventItem {
  _id: string;
  station: string;
  type: string;
  startTime: string;
  startTimeIST?: string;
  endTime?: string;
  duration?: number;
  direction?: string;
  active: boolean;
}

interface NoiseProfileItem {
  _id: string;
  sensorId: string;
  recordedAt: string;
  localTime?: string;
  durationSeconds: number;
  samplesCount?: number;
  accelerationNoise: {
    y: { min: number; max: number; mean: number; stdDev: number; rms: number };
    z: { min: number; max: number; mean: number; stdDev: number; rms: number };
  };
  voltageFluctuations: {
    y: { min: number; max: number; mean: number; stdDev: number; vpp: number };
    z: { min: number; max: number; mean: number; stdDev: number; vpp: number };
  };
  dominantFrequencies: { y: number; z: number };
  notes?: string;
  matchDistance?: { milliseconds: number; hours: number; description: string };
}

interface DataPoint { t: string; y_g: number; z_g: number; y_v: number; z_v: number; }

interface AxisMetrics {
  raw: { rms: number; peak: number; energy: number; mean: number; samples: number };
  filtered: { rms: number; peak: number; energy: number; mean: number; samples: number };
  improvement: { snrBefore: number; snrAfter: number; noiseRemovedPercent: number; rmsReduction: number; peakReduction: number };
}

interface SensorResult {
  rawData: DataPoint[];
  filteredData: DataPoint[];
  totalSamples: number;
  metrics: { y: AxisMetrics | null; z: AxisMetrics | null };
}

interface FilterResult {
  success: boolean;
  event: TrainEventItem;
  profiles: { left: NoiseProfileItem; right: NoiseProfileItem };
  filter: { method: string; params: Record<string, number> };
  left: SensorResult;
  right: SensorResult;
}

// ── Helpers ─────────────────────────────────────────────────
const toLocalDatetimeStr = (d: Date): string => {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const formatIST = (isoStr: string): string => {
  try {
    return new Date(isoStr).toLocaleString('en-GB', {
      timeZone: 'Asia/Colombo', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  } catch { return isoStr; }
};

const formatDuration = (ms: number): string => {
  if (!ms) return '—';
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const FILTER_METHODS = [
  { id: 'mean_subtraction', name: 'Mean Subtraction', icon: TrendingDown, color: 'cyan', desc: 'Remove DC offset using noise baseline mean' },
  { id: 'threshold_gate', name: 'Threshold Gate', icon: Sliders, color: 'violet', desc: 'Zero out samples within ±Nσ of noise floor' },
  { id: 'moving_average', name: 'Moving Average', icon: Waves, color: 'emerald', desc: 'Smooth signal with sliding window' },
  { id: 'spectral_subtraction', name: 'Spectral Subtraction', icon: BarChart3, color: 'amber', desc: 'Remove noise frequency components via FFT' },
  { id: 'bandpass', name: 'Bandpass Filter', icon: Filter, color: 'rose', desc: 'Keep only frequencies in target range' },
];

const COLOR_MAP: Record<string, string> = {
  cyan: 'rgba(6,182,212,', violet: 'rgba(139,92,246,', emerald: 'rgba(16,185,129,',
  amber: 'rgba(245,158,11,', rose: 'rgba(244,63,94,',
};

// ── Sensor Chart (Before / After / Noise) ───────────────────
const SensorChart: React.FC<{
  title: string; accent: string; data: DataPoint[]; filtered: DataPoint[];
  chartAxis: 'y' | 'z'; eventStart?: number; eventEnd?: number | null;
  noiseUpper?: number; noiseLower?: number; noiseMean?: number;
}> = ({ title, accent, data, filtered, chartAxis, eventStart, eventEnd, noiseUpper, noiseLower, noiseMean }) => {
  const chartData = useMemo(() => {
    if (data.length === 0) return [];
    const t0 = new Date(data[0].t).getTime();
    const key = `${chartAxis}_g` as 'y_g' | 'z_g';
    return data.map((r, i) => {
      const f = filtered[i] || r;
      return {
        timeSec: parseFloat(((new Date(r.t).getTime() - t0) / 1000).toFixed(3)),
        raw: r[key], filtered: f[key], noise: r[key] - f[key]
      };
    });
  }, [data, filtered, chartAxis]);

  if (chartData.length === 0) {
    return (
      <Card className="bg-slate-900/70 border-slate-800/50">
        <CardContent className="py-12 text-center text-slate-500 text-sm">
          No data available for {title}
        </CardContent>
      </Card>
    );
  }

  const isCyan = accent === 'left';
  const accentBorder = isCyan ? 'border-cyan-900/30' : 'border-purple-900/30';
  const dotColor = isCyan ? 'bg-cyan-400' : 'bg-purple-400';
  const filteredColor = isCyan ? '#06b6d4' : '#a855f7';

  const commonXAxis = { dataKey: 'timeSec' as const, stroke: '#475569', fontSize: 8, tickFormatter: (v: number) => `${Number(v).toFixed(0)}s` };
  const commonYAxis = { stroke: '#475569', fontSize: 8, tickFormatter: (v: number) => `${Number(v).toFixed(2)}g` };
  const commonTooltip = {
    contentStyle: { background: '#090d16', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '10px' },
    labelFormatter: (v: number) => `t = ${Number(v).toFixed(2)}s`
  };

  return (
    <Card className={`bg-slate-900/70 ${accentBorder}`}>
      <CardHeader className="pb-1 pt-3">
        <CardTitle className="text-xs text-slate-400 font-medium flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${dotColor}`} />
          {title}
          <span className="text-[10px] text-slate-500 ml-auto">{chartData.length} pts</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-1">

        {/* ── BEFORE FILTER ── */}
        <div>
          <div className="flex items-center gap-1.5 px-1 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Before Filter</span>
            <span className="text-[8px] text-slate-600">(Raw Signal + Noise)</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis {...commonXAxis} />
              <YAxis {...commonYAxis} />
              <Tooltip {...commonTooltip}
                formatter={(value: number) => [`${value.toFixed(5)} g`, 'Raw']} />
              {noiseUpper != null && <ReferenceLine y={noiseUpper} stroke="#ef444450" strokeDasharray="4 4" strokeWidth={1} label={{ value: '+3σ', position: 'right', fill: '#ef4444', fontSize: 7 }} />}
              {noiseLower != null && <ReferenceLine y={noiseLower} stroke="#ef444450" strokeDasharray="4 4" strokeWidth={1} label={{ value: '-3σ', position: 'right', fill: '#ef4444', fontSize: 7 }} />}
              {noiseMean != null && <ReferenceLine y={noiseMean} stroke="#f59e0b30" strokeDasharray="2 4" strokeWidth={1} />}
              {eventStart != null && <ReferenceLine x={eventStart} stroke="#22c55e" strokeWidth={1} label={{ value: 'START', position: 'top', fill: '#22c55e', fontSize: 7 }} />}
              {eventEnd != null && <ReferenceLine x={eventEnd} stroke="#ef4444" strokeWidth={1} label={{ value: 'END', position: 'top', fill: '#ef4444', fontSize: 7 }} />}
              <Line type="linear" dataKey="raw" stroke="#ef444490" strokeWidth={1.2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── AFTER FILTER ── */}
        <div>
          <div className="flex items-center gap-1.5 px-1 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">After Filter</span>
            <span className="text-[8px] text-slate-600">(Clean Signal)</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis {...commonXAxis} />
              <YAxis {...commonYAxis} />
              <Tooltip {...commonTooltip}
                formatter={(value: number) => [`${value.toFixed(5)} g`, 'Filtered']} />
              {eventStart != null && <ReferenceLine x={eventStart} stroke="#22c55e80" strokeWidth={1} />}
              {eventEnd != null && <ReferenceLine x={eventEnd} stroke="#ef444480" strokeWidth={1} />}
              <Line type="linear" dataKey="filtered" stroke={filteredColor} strokeWidth={1.4} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── REMOVED NOISE ── */}
        <div>
          <div className="flex items-center gap-1.5 px-1 mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Removed Noise</span>
            <span className="text-[8px] text-slate-600">(Raw − Filtered)</span>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={chartData}>
              <XAxis {...commonXAxis} fontSize={7} />
              <YAxis stroke="#475569" fontSize={7} />
              <Area type="linear" dataKey="noise" stroke="#f59e0b80" fill="#f59e0b" fillOpacity={0.12} strokeWidth={0.8} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

      </CardContent>
    </Card>
  );
};

// ── Metric Card ──────────────────────────────────────────────
const MetricCard: React.FC<{
  label: string; rawVal: string; filtVal: string;
  change: string; positive?: boolean; icon: React.ReactNode;
}> = ({ label, rawVal, filtVal, change, positive, icon }) => (
  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
    <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
      {icon} {label}
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div>
        <div className="text-[9px] text-slate-500">Raw</div>
        <div className="text-xs font-bold font-mono text-slate-300">{rawVal}</div>
      </div>
      <div>
        <div className="text-[9px] text-slate-500">Filtered</div>
        <div className="text-xs font-bold font-mono text-cyan-300">{filtVal}</div>
      </div>
    </div>
    <div className={`text-[10px] font-semibold ${positive ? 'text-emerald-400' : 'text-amber-400'}`}>{change}</div>
  </div>
);

// ── Metrics Row ──────────────────────────────────────────────
const MetricsRow: React.FC<{ label: string; metrics: AxisMetrics | null; accent: string }> = ({ label, metrics, accent }) => {
  if (!metrics) return null;
  const m = metrics;
  return (
    <div className="space-y-2">
      <div className={`text-xs font-semibold flex items-center gap-2 ${accent === 'left' ? 'text-cyan-400' : 'text-purple-400'}`}>
        <div className={`w-2 h-2 rounded-full ${accent === 'left' ? 'bg-cyan-400' : 'bg-purple-400'}`} /> {label}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <MetricCard label="RMS" icon={<Activity className="w-3 h-3 text-cyan-400" />}
          rawVal={`${m.raw.rms.toFixed(5)}g`} filtVal={`${m.filtered.rms.toFixed(5)}g`}
          change={`${m.improvement.rmsReduction > 0 ? '↓' : '↑'} ${Math.abs(m.improvement.rmsReduction).toFixed(1)}%`}
          positive={m.improvement.rmsReduction > 0} />
        <MetricCard label="Peak" icon={<TrendingUp className="w-3 h-3 text-violet-400" />}
          rawVal={`${m.raw.peak.toFixed(5)}g`} filtVal={`${m.filtered.peak.toFixed(5)}g`}
          change={`${m.improvement.peakReduction > 0 ? '↓' : '↑'} ${Math.abs(m.improvement.peakReduction).toFixed(1)}%`}
          positive={m.improvement.peakReduction > 0} />
        <MetricCard label="Energy" icon={<Zap className="w-3 h-3 text-amber-400" />}
          rawVal={`${m.raw.energy.toFixed(4)}`} filtVal={`${m.filtered.energy.toFixed(4)}`}
          change={`${m.improvement.noiseRemovedPercent.toFixed(1)}% removed`}
          positive={m.improvement.noiseRemovedPercent > 0} />
        <MetricCard label="SNR (dB)" icon={<BarChart3 className="w-3 h-3 text-rose-400" />}
          rawVal={`${isFinite(m.improvement.snrBefore) ? m.improvement.snrBefore.toFixed(1) : '∞'} dB`}
          filtVal={`${isFinite(m.improvement.snrAfter) ? m.improvement.snrAfter.toFixed(1) : '∞'} dB`}
          change={isFinite(m.improvement.snrAfter - m.improvement.snrBefore) ? `${(m.improvement.snrAfter - m.improvement.snrBefore) > 0 ? '+' : ''}${(m.improvement.snrAfter - m.improvement.snrBefore).toFixed(1)} dB` : 'N/A'}
          positive={(m.improvement.snrAfter - m.improvement.snrBefore) > 0} />
        <MetricCard label="DC Offset" icon={<Sparkles className="w-3 h-3 text-emerald-400" />}
          rawVal={`${m.raw.mean.toFixed(5)}g`} filtVal={`${m.filtered.mean.toFixed(5)}g`}
          change={Math.abs(m.filtered.mean) < Math.abs(m.raw.mean) ? 'Offset reduced' : 'Stable'}
          positive={Math.abs(m.filtered.mean) < Math.abs(m.raw.mean)} />
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// ── Main Component ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
const NoiseFilter: React.FC = () => {
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(() => toLocalDatetimeStr(new Date()).slice(0, 10));
  const [events, setEvents] = useState<TrainEventItem[]>([]);
  const [profiles, setProfiles] = useState<NoiseProfileItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [leftProfileId, setLeftProfileId] = useState('');
  const [rightProfileId, setRightProfileId] = useState('');

  // Filter config
  const [filterMethod, setFilterMethod] = useState('threshold_gate');
  const [sigmaMultiplier, setSigmaMultiplier] = useState(3);
  const [windowSize, setWindowSize] = useState(5);
  const [subtractionFactor, setSubtractionFactor] = useState(1.0);
  const [lowCutoff, setLowCutoff] = useState(0.5);
  const [highCutoff, setHighCutoff] = useState(5.0);
  const [bufferBefore, setBufferBefore] = useState(10);
  const [bufferAfter, setBufferAfter] = useState(10);

  // Results
  const [filterResult, setFilterResult] = useState<FilterResult | null>(null);
  const [filtering, setFiltering] = useState(false);
  const [chartAxis, setChartAxis] = useState<'y' | 'z'>('z');

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveNotes, setSaveNotes] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // ── Fetch Events ────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const dayStart = new Date(selectedDate + 'T00:00:00');
      const dayEnd = endOfDay(dayStart);
      const params = new URLSearchParams({ from: dayStart.toISOString(), to: dayEnd.toISOString(), limit: '200' });
      const res = await fetch(`${API_URL}/analysis/events?${params}`);
      const json = await res.json();
      if (json.success) {
        setEvents(json.data);
        if (json.data.length > 0 && !selectedEventId) setSelectedEventId(json.data[0]._id);
      }
    } catch { toast.error('Failed to load train events'); }
    setEventsLoading(false);
  }, [selectedDate]);

  // ── Fetch all Noise Profiles ───────────────────────────────
  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/noise/profiles`);
      const json = await res.json();
      if (json.success) {
        setProfiles(json.data);
        // Auto-select first left and first right profile
        const leftProfiles = json.data.filter((p: NoiseProfileItem) => p.sensorId === 'sensor2');
        const rightProfiles = json.data.filter((p: NoiseProfileItem) => p.sensorId === 'sensor1');
        if (leftProfiles.length > 0 && !leftProfileId) setLeftProfileId(leftProfiles[0]._id);
        if (rightProfiles.length > 0 && !rightProfileId) setRightProfileId(rightProfiles[0]._id);
      }
    } catch { /* silent */ }
  }, []);

  // Initialize selectedDate with the latest event date dynamically on mount
  useEffect(() => {
    const initializeDate = async () => {
      try {
        const res = await fetch(`${API_URL}/analysis/events?limit=1`);
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          const latestEvent = json.data[0];
          const localDateStr = toLocalDatetimeStr(new Date(latestEvent.startTime)).slice(0, 10);
          setSelectedDate(localDateStr);
        }
      } catch (err) {
        console.error('Failed to initialize date from latest event:', err);
      }
    };
    initializeDate();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchEvents();
    }
  }, [selectedDate, fetchEvents]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // ── Auto-match profiles ────────────────────────────────────
  const autoMatchProfile = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      const res = await fetch(`${API_URL}/filter/preview/${selectedEventId}`);
      const json = await res.json();
      if (json.success && json.matchedProfiles) {
        const left = json.matchedProfiles.left;
        const right = json.matchedProfiles.right;
        if (left) setLeftProfileId(left._id);
        if (right) setRightProfileId(right._id);
        toast.success(
          `Left: ${left?.matchDistance?.description || 'N/A'} | Right: ${right?.matchDistance?.description || 'N/A'}`
        );
        if (!left && !right) toast.error('No matching profiles found');
      }
    } catch { toast.error('Failed to auto-match'); }
  }, [selectedEventId]);

  // ── Apply Filter ───────────────────────────────────────────
  const applyFilter = useCallback(async () => {
    if (!selectedEventId || (!leftProfileId && !rightProfileId)) {
      toast.error('Please select an event and at least one noise profile');
      return;
    }
    setFiltering(true);
    setSavedSuccess(false);
    try {
      const params: Record<string, number> = {};
      if (filterMethod === 'threshold_gate') params.sigmaMultiplier = sigmaMultiplier;
      if (filterMethod === 'moving_average') params.windowSize = windowSize;
      if (filterMethod === 'spectral_subtraction') params.subtractionFactor = subtractionFactor;
      if (filterMethod === 'bandpass') { params.lowCutoff = lowCutoff; params.highCutoff = highCutoff; }

      const res = await fetch(`${API_URL}/filter/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEventId,
          profileId: leftProfileId || rightProfileId,
          profileId2: rightProfileId || leftProfileId,
          method: filterMethod,
          params, bufferBefore, bufferAfter
        })
      });
      const json = await res.json();
      if (json.success) {
        const emptySensor: SensorResult = { rawData: [], filteredData: [], totalSamples: 0, metrics: { y: null, z: null } };
        if (!json.left) json.left = emptySensor;
        if (!json.right) json.right = emptySensor;
        if (!json.profiles) json.profiles = { left: json.profile, right: json.profile };
        setFilterResult(json);
        toast.success(`Filter applied — Left: ${json.left.totalSamples} samples, Right: ${json.right.totalSamples} samples`);
      } else {
        toast.error(json.message || 'Filter failed');
      }
    } catch { toast.error('Network error during filtering'); }
    setFiltering(false);
  }, [selectedEventId, leftProfileId, rightProfileId, filterMethod, sigmaMultiplier, windowSize, subtractionFactor, lowCutoff, highCutoff, bufferBefore, bufferAfter]);

  // ── Event markers ──────────────────────────────────────────
  const getEventMarkers = useCallback((data: DataPoint[]) => {
    if (!filterResult || data.length === 0) return { start: undefined, end: undefined };
    const t0 = new Date(data[0].t).getTime();
    const startSec = (new Date(filterResult.event.startTime).getTime() - t0) / 1000;
    const endSec = filterResult.event.endTime ? (new Date(filterResult.event.endTime).getTime() - t0) / 1000 : null;
    return { start: startSec, end: endSec };
  }, [filterResult]);

  // ── Noise thresholds from profile ──────────────────────────
  const getNoiseThresholds = useCallback((profile: NoiseProfileItem | undefined, axis: 'y' | 'z') => {
    if (!profile) return { mean: undefined, upper: undefined, lower: undefined };
    const m = profile.accelerationNoise[axis]?.mean ?? 0;
    const s = profile.accelerationNoise[axis]?.stdDev ?? 0;
    return { mean: m, upper: m + s * 3, lower: m - s * 3 };
  }, []);

  // ── CSV Export ─────────────────────────────────────────────
  const exportCSV = () => {
    if (!filterResult) return;
    const buildRows = (label: string, raw: DataPoint[], filt: DataPoint[]) =>
      raw.map((r, i) => {
        const f = filt[i] || r;
        return `${label},${r.t},${r.y_g},${r.z_g},${f.y_g},${f.z_g},${r.y_g - f.y_g},${r.z_g - f.z_g}`;
      });
    const header = 'sensor,timestamp,raw_y_g,raw_z_g,filtered_y_g,filtered_z_g,noise_y,noise_z\n';
    const leftRows = buildRows('left', filterResult.left.rawData, filterResult.left.filteredData);
    const rightRows = buildRows('right', filterResult.right.rawData, filterResult.right.filteredData);
    const blob = new Blob([header + [...leftRows, ...rightRows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filtered_both_${filterResult.filter.method}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported (both sensors)');
  };

  // ── Save filtered data to database ─────────────────────────
  const saveFilteredData = useCallback(async () => {
    if (!filterResult) return;
    setSaving(true);
    setSavedSuccess(false);
    try {
      const params: Record<string, number> = {};
      if (filterMethod === 'threshold_gate') params.sigmaMultiplier = sigmaMultiplier;
      if (filterMethod === 'moving_average') params.windowSize = windowSize;
      if (filterMethod === 'spectral_subtraction') params.subtractionFactor = subtractionFactor;
      if (filterMethod === 'bandpass') { params.lowCutoff = lowCutoff; params.highCutoff = highCutoff; }

      const res = await fetch(`${API_URL}/filter/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: filterResult.event._id,
          profileId: leftProfileId || rightProfileId,
          method: filterMethod,
          params,
          bufferBefore,
          bufferAfter,
          notes: saveNotes
        })
      });
      const json = await res.json();
      if (json.success) {
        setSavedSuccess(true);
        toast.success(`${json.message} — clean data saved to database`);
      } else {
        toast.error(json.message || 'Failed to save');
      }
    } catch { toast.error('Network error while saving'); }
    setSaving(false);
  }, [filterResult, filterMethod, leftProfileId, rightProfileId, sigmaMultiplier, windowSize, subtractionFactor, lowCutoff, highCutoff, bufferBefore, bufferAfter, saveNotes]);

  // ── Selected profiles for summary ──────────────────────────
  const leftProfile = useMemo(() => profiles.find(p => p._id === leftProfileId), [profiles, leftProfileId]);
  const rightProfile = useMemo(() => profiles.find(p => p._id === rightProfileId), [profiles, rightProfileId]);

  // Separate profile lists
  const leftProfiles = useMemo(() => profiles.filter(p => p.sensorId === 'sensor2'), [profiles]);
  const rightProfiles = useMemo(() => profiles.filter(p => p.sensorId === 'sensor1'), [profiles]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-orange-400 via-rose-400 to-pink-400 bg-clip-text text-transparent">
                  Noise Filter Design
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">Analyze &amp; remove noise from both sensors simultaneously</p>
              </div>
            </div>
            {filterResult && (
              <Badge className="bg-emerald-600/15 text-emerald-300 border border-emerald-500/25 text-xs">
                <CheckCircle className="w-3 h-3 mr-1" />
                L:{filterResult.left?.totalSamples ?? 0} R:{filterResult.right?.totalSamples ?? 0} filtered
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 space-y-5">

        {/* ── Selection Panel ──────────────────────────────── */}
        <Card className="bg-slate-900/70 border-slate-800/50 backdrop-blur-sm">
          <CardContent className="pt-5 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">Date</Label>
                <Input id="filter-date" type="date" value={selectedDate}
                  onChange={e => { setSelectedDate(e.target.value); setSelectedEventId(''); }}
                  className="bg-slate-800/60 border-slate-700/50 text-slate-200 text-sm h-10" />
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">
                  Train Event {eventsLoading && <Loader2 className="w-3 h-3 inline animate-spin ml-1" />}
                </Label>
                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                  <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-sm h-10"><SelectValue placeholder="Select event..." /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 max-h-[300px]">
                    {events.length === 0 ? <SelectItem value="__none" disabled>No events</SelectItem> :
                      events.map(ev => <SelectItem key={ev._id} value={ev._id}>{formatIST(ev.startTime)} • {formatDuration(ev.duration || 0)} • {ev.type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={autoMatchProfile} disabled={!selectedEventId} variant="outline"
                  className="h-10 border-rose-500/30 text-rose-300 hover:bg-rose-500/10 gap-1 flex-1">
                  <Sparkles className="w-3.5 h-3.5" /> Auto Match
                </Button>
                <Button onClick={fetchEvents} variant="outline" className="h-10 border-slate-700/50 text-slate-400 hover:bg-slate-700/40">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            {/* Separate profile selectors for each sensor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-800/40">
              <div>
                <Label className="text-xs text-cyan-400 mb-1.5 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" /> Left Sensor Profile (sensor2 / A)
                </Label>
                <Select value={leftProfileId} onValueChange={setLeftProfileId}>
                  <SelectTrigger className="bg-slate-800/60 border-cyan-900/30 text-sm h-10"><SelectValue placeholder="Select left profile..." /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 max-h-[300px]">
                    {leftProfiles.length === 0 ? <SelectItem value="__none" disabled>No left sensor profiles</SelectItem> :
                      leftProfiles.map(p => <SelectItem key={p._id} value={p._id}>{formatIST(p.recordedAt)} • {p.durationSeconds}s</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-purple-400 mb-1.5 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-purple-400" /> Right Sensor Profile (sensor1 / B)
                </Label>
                <Select value={rightProfileId} onValueChange={setRightProfileId}>
                  <SelectTrigger className="bg-slate-800/60 border-purple-900/30 text-sm h-10"><SelectValue placeholder="Select right profile..." /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 max-h-[300px]">
                    {rightProfiles.length === 0 ? <SelectItem value="__none" disabled>No right sensor profiles</SelectItem> :
                      rightProfiles.map(p => <SelectItem key={p._id} value={p._id}>{formatIST(p.recordedAt)} • {p.durationSeconds}s</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Profile Summary + Filter Config ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Profile Summary — both sensors */}
          <Card className="bg-slate-900/70 border-slate-800/50">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-400" /> Noise Profiles
            </CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* Left profile summary */}
              <div>
                <div className="text-[10px] text-cyan-400 font-semibold flex items-center gap-1 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Left (A)
                </div>
                {leftProfile ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60">
                      <div className="text-[8px] text-slate-500 font-bold">Y σ</div>
                      <div className="text-[11px] font-bold font-mono text-blue-400">{leftProfile.accelerationNoise.y.stdDev.toFixed(5)}g</div>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60">
                      <div className="text-[8px] text-slate-500 font-bold">Z σ</div>
                      <div className="text-[11px] font-bold font-mono text-emerald-400">{leftProfile.accelerationNoise.z.stdDev.toFixed(5)}g</div>
                    </div>
                  </div>
                ) : <div className="text-[10px] text-slate-600 italic">Not selected</div>}
              </div>
              {/* Right profile summary */}
              <div>
                <div className="text-[10px] text-purple-400 font-semibold flex items-center gap-1 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400" /> Right (B)
                </div>
                {rightProfile ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60">
                      <div className="text-[8px] text-slate-500 font-bold">Y σ</div>
                      <div className="text-[11px] font-bold font-mono text-blue-400">{rightProfile.accelerationNoise.y.stdDev.toFixed(5)}g</div>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/60">
                      <div className="text-[8px] text-slate-500 font-bold">Z σ</div>
                      <div className="text-[11px] font-bold font-mono text-emerald-400">{rightProfile.accelerationNoise.z.stdDev.toFixed(5)}g</div>
                    </div>
                  </div>
                ) : <div className="text-[10px] text-slate-600 italic">Not selected</div>}
              </div>
            </CardContent>
          </Card>

          {/* Filter Config */}
          <Card className="bg-slate-900/70 border-slate-800/50 lg:col-span-3">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-orange-400" /> Filter Configuration
            </CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* Method cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                {FILTER_METHODS.map(fm => {
                  const Icon = fm.icon;
                  const sel = filterMethod === fm.id;
                  const c = COLOR_MAP[fm.color] || 'rgba(100,100,100,';
                  return (
                    <button key={fm.id} onClick={() => setFilterMethod(fm.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all duration-200 ${sel ? 'ring-1 shadow-lg' : 'bg-slate-800/40 border-slate-700/30 hover:bg-slate-800/60'}`}
                      style={sel ? { backgroundColor: c + '0.1)', borderColor: c + '0.4)', boxShadow: `0 4px 20px ${c}0.15)` } : {}}>
                      <Icon className={`w-3.5 h-3.5 mb-1 ${sel ? '' : 'text-slate-500'}`} style={sel ? { color: c + '1)' } : {}} />
                      <div className={`text-[11px] font-semibold ${sel ? 'text-slate-200' : 'text-slate-400'}`}>{fm.name}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5 leading-tight">{fm.desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* Params + Apply */}
              <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800/40">
                {filterMethod === 'threshold_gate' && (
                  <div className="flex-1 min-w-[140px]">
                    <Label className="text-[10px] text-slate-400 mb-1 block">Sigma (Nσ)</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <button key={s} onClick={() => setSigmaMultiplier(s)}
                          className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${sigmaMultiplier === s ? 'bg-violet-500/15 border-violet-400/40 text-violet-300' : 'bg-slate-800/40 border-slate-700/30 text-slate-400 hover:text-slate-200'}`}>
                          {s}σ
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {filterMethod === 'moving_average' && (
                  <div className="min-w-[150px]">
                    <Label className="text-[10px] text-slate-400 mb-1 block">Window: {windowSize}</Label>
                    <input type="range" min={3} max={50} step={2} value={windowSize}
                      onChange={e => setWindowSize(parseInt(e.target.value))} className="w-full accent-emerald-400" />
                  </div>
                )}
                {filterMethod === 'spectral_subtraction' && (
                  <div className="min-w-[150px]">
                    <Label className="text-[10px] text-slate-400 mb-1 block">Factor: {subtractionFactor.toFixed(1)}x</Label>
                    <input type="range" min={0.5} max={3.0} step={0.1} value={subtractionFactor}
                      onChange={e => setSubtractionFactor(parseFloat(e.target.value))} className="w-full accent-amber-400" />
                  </div>
                )}
                {filterMethod === 'bandpass' && (
                  <>
                    <div className="min-w-[90px]">
                      <Label className="text-[10px] text-slate-400 mb-1 block">Low Hz</Label>
                      <Input type="number" step={0.1} min={0} value={lowCutoff}
                        onChange={e => setLowCutoff(parseFloat(e.target.value) || 0)}
                        className="bg-slate-800/60 border-slate-700/50 text-xs h-8" />
                    </div>
                    <div className="min-w-[90px]">
                      <Label className="text-[10px] text-slate-400 mb-1 block">High Hz</Label>
                      <Input type="number" step={0.1} min={0} value={highCutoff}
                        onChange={e => setHighCutoff(parseFloat(e.target.value) || 5)}
                        className="bg-slate-800/60 border-slate-700/50 text-xs h-8" />
                    </div>
                  </>
                )}
                {filterMethod === 'mean_subtraction' && (
                  <div className="text-[10px] text-slate-500 italic py-1.5">No parameters — subtracts noise mean offset.</div>
                )}
                <div className="min-w-[65px]">
                  <Label className="text-[10px] text-slate-400 mb-1 block">Before(s)</Label>
                  <Input type="number" min={0} max={120} value={bufferBefore}
                    onChange={e => setBufferBefore(parseInt(e.target.value) || 0)}
                    className="bg-slate-800/60 border-slate-700/50 text-xs h-8 w-16" />
                </div>
                <div className="min-w-[65px]">
                  <Label className="text-[10px] text-slate-400 mb-1 block">After(s)</Label>
                  <Input type="number" min={0} max={120} value={bufferAfter}
                    onChange={e => setBufferAfter(parseInt(e.target.value) || 0)}
                    className="bg-slate-800/60 border-slate-700/50 text-xs h-8 w-16" />
                </div>
                <Button id="apply-filter-btn" onClick={applyFilter}
                  disabled={filtering || !selectedEventId || (!leftProfileId && !rightProfileId)}
                  className="h-9 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-white font-bold gap-2 px-5 shadow-lg shadow-rose-900/30 disabled:opacity-50 transition-all hover:scale-[1.02]">
                  {filtering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Apply Filter
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Results ─────────────────────────────────────── */}
        {filterResult && (
          <>
            {/* Axis tabs + export */}
            <div className="flex items-center justify-between">
              <Tabs value={chartAxis} onValueChange={(v) => setChartAxis(v as 'y' | 'z')}>
                <TabsList className="bg-slate-800/60 border border-slate-700/30">
                  <TabsTrigger value="z" className="text-xs data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300">Z-Axis (Vertical)</TabsTrigger>
                  <TabsTrigger value="y" className="text-xs data-[state=active]:bg-blue-500/15 data-[state=active]:text-blue-300">Y-Axis (Lateral)</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-500">
                  Filter: {FILTER_METHODS.find(f => f.id === filterResult.filter.method)?.name}
                  {filterResult.filter.method === 'threshold_gate' && ` (${filterResult.filter.params.sigmaMultiplier || 3}σ)`}
                  {filterResult.filter.method === 'moving_average' && ` (w=${filterResult.filter.params.windowSize || 5})`}
                </span>
                <Button variant="outline" onClick={exportCSV} className="h-7 text-[10px] border-slate-700/50 text-slate-300 gap-1">
                  <Download className="w-3 h-3" /> CSV
                </Button>
              </div>
            </div>

            {/* Side-by-side sensor charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Sensor */}
              <SensorChart
                title="Left Sensor (sensor2 / A)"
                accent="left"
                data={filterResult.left.rawData}
                filtered={filterResult.left.filteredData}
                chartAxis={chartAxis}
                eventStart={getEventMarkers(filterResult.left.rawData).start}
                eventEnd={getEventMarkers(filterResult.left.rawData).end}
                noiseUpper={getNoiseThresholds(filterResult.profiles.left, chartAxis).upper}
                noiseLower={getNoiseThresholds(filterResult.profiles.left, chartAxis).lower}
                noiseMean={getNoiseThresholds(filterResult.profiles.left, chartAxis).mean}
              />
              {/* Right Sensor */}
              <SensorChart
                title="Right Sensor (sensor1 / B)"
                accent="right"
                data={filterResult.right.rawData}
                filtered={filterResult.right.filteredData}
                chartAxis={chartAxis}
                eventStart={getEventMarkers(filterResult.right.rawData).start}
                eventEnd={getEventMarkers(filterResult.right.rawData).end}
                noiseUpper={getNoiseThresholds(filterResult.profiles.right, chartAxis).upper}
                noiseLower={getNoiseThresholds(filterResult.profiles.right, chartAxis).lower}
                noiseMean={getNoiseThresholds(filterResult.profiles.right, chartAxis).mean}
              />
            </div>

            {/* Metrics */}
            <Card className="bg-slate-900/70 border-slate-800/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-slate-200 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  Filter Effectiveness — {chartAxis.toUpperCase()}-Axis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <MetricsRow label="Left Sensor (sensor2 / A)" metrics={filterResult.left.metrics[chartAxis]} accent="left" />
                <MetricsRow label="Right Sensor (sensor1 / B)" metrics={filterResult.right.metrics[chartAxis]} accent="right" />
              </CardContent>
            </Card>

            {/* ── Save to Database ───────────────────────────── */}
            <Card className={`border ${savedSuccess ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-slate-900/70 border-orange-900/30'}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-slate-200 flex items-center gap-2">
                  <Database className="w-4 h-4 text-orange-400" />
                  Save Noise-Free Signal to Database
                  {savedSuccess && (
                    <Badge className="ml-2 text-[9px] bg-emerald-600/15 text-emerald-300 border border-emerald-500/25">
                      <CheckCircle className="w-3 h-3 mr-1" /> Saved
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[11px] text-slate-500 mb-3">
                  Save the filtered (clean) signal for both sensors to a separate <code className="text-orange-300">FilteredRecord</code> collection.
                  The original raw data in <code className="text-slate-400">MqttRecord</code> is never modified.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-[10px] text-slate-400 mb-1 block">Notes (optional)</Label>
                    <Input
                      placeholder="e.g. Best filter config for daytime noise..."
                      value={saveNotes}
                      onChange={e => setSaveNotes(e.target.value)}
                      className="bg-slate-800/60 border-slate-700/50 text-xs h-9"
                    />
                  </div>
                  <Button
                    id="save-filtered-btn"
                    onClick={saveFilteredData}
                    disabled={saving}
                    className={`h-9 gap-2 px-6 font-bold shadow-lg transition-all hover:scale-[1.02] ${
                      savedSuccess
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                        : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-blue-900/30'
                    }`}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savedSuccess ? 'Saved ✓' : 'Save to Database'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Empty state */}
        {!filterResult && !filtering && (
          <Card className="bg-slate-900/50 border-slate-800/30">
            <CardContent className="py-16 text-center">
              <div className="inline-flex p-4 rounded-2xl bg-slate-800/30 mb-4">
                <Filter className="w-10 h-10 text-slate-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-400 mb-2">No Filter Applied Yet</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Select a train event and noise profile, configure your filter, then click <strong>Apply Filter</strong>
                to see before/after analysis for <strong>both sensors</strong>.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default NoiseFilter;
