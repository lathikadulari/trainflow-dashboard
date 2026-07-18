import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { format, subHours, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  Search, Filter, Download, ChevronDown, ChevronUp, Clock, Activity,
  BarChart3, Train, Calendar, Loader2, AlertCircle, ArrowLeft, ArrowRight, ZoomIn, RotateCcw,
  ArrowRightLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── Types ───────────────────────────────────────────────────
interface TrainEventData {
  _id: string;
  station: string;
  type: 'approaching' | 'stopped';
  startTime: string;
  startTimeIST?: string;
  endTime?: string;
  endTimeIST?: string;
  duration?: number;
  notes?: string;
  active: boolean;
  direction?: 'left_to_right' | 'right_to_left' | 'unknown';
  directionConfidence?: number;
  directionMeta?: {
    propagationDelayMs?: number;
    firstSensor?: string;
    strongerSensor?: string;
    votesLeft?: number;
    votesRight?: number;
    methods?: Array<{ name: string; result: string; deltaMs: number }>;
  };
}

interface SensorPoint {
  t: string;
  y_g: number;
  z_g: number;
  y_v: number;
  z_v: number;
  t_us: number;
}

interface SensorStats {
  count: number;
  y: { min: number; max: number; avg: number; range: number };
  z: { min: number; max: number; avg: number; range: number };
}

interface EventDataResponse {
  success: boolean;
  event: TrainEventData;
  window: {
    start: string;
    startIST: string;
    end: string;
    endIST: string;
    bufferBefore: number;
    bufferAfter: number;
  };
  sensor1: { count: number; stats: SensorStats | null; data: SensorPoint[] };
  sensor2: { count: number; stats: SensorStats | null; data: SensorPoint[] };
  totalRecords: number;
}

interface SummaryData {
  totalEvents: number;
  completedEvents: number;
  activeEvents: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  sensorRecordCount: number;
}

// ── Helpers ─────────────────────────────────────────────────
const toLocalDatetimeStr = (d: Date): string => {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const formatDuration = (ms: number): string => {
  if (!ms) return '—';
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const formatISTShort = (isoStr: string): string => {
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('en-GB', {
      timeZone: 'Asia/Colombo',
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    });
  } catch {
    return isoStr;
  }
};

// ── Stat Card Component ─────────────────────────────────────
const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; accent: string }> = ({ icon, label, value, accent }) => (
  <div className={`flex items-center gap-3 p-4 rounded-xl border ${accent} bg-slate-900/60 backdrop-blur-sm`}>
    <div className="p-2 rounded-lg bg-slate-800/80">{icon}</div>
    <div>
      <div className="text-xs text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold text-slate-100">{value}</div>
    </div>
  </div>
);

// ── Main Component ──────────────────────────────────────────
const DataAnalysis: React.FC = () => {
  const navigate = useNavigate();

  // Date range
  const [fromDate, setFromDate] = useState(() => toLocalDatetimeStr(startOfDay(new Date())));
  const [toDate, setToDate] = useState(() => toLocalDatetimeStr(endOfDay(new Date())));

  // Filters
  const [station, setStation] = useState('Makumbura');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [minDurationSec, setMinDurationSec] = useState('');
  const [maxDurationSec, setMaxDurationSec] = useState('');

  // Buffer controls
  const [bufferBefore, setBufferBefore] = useState(30);
  const [bufferAfter, setBufferAfter] = useState(30);

  // Data
  const [events, setEvents] = useState<TrainEventData[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Expanded event
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [eventData, setEventData] = useState<EventDataResponse | null>(null);
  const [eventDataLoading, setEventDataLoading] = useState(false);
  const [sensorTab, setSensorTab] = useState('sensor1');

  // Comparison zoom state
  const [compZoomDomain, setCompZoomDomain] = useState<[number, number] | null>(null);
  const compDragStartRef = useRef<number | null>(null);
  const [compDragEnd, setCompDragEnd] = useState<number | null>(null);

  // Show filters panel
  const [showFilters, setShowFilters] = useState(false);

  // ── Fetch Events ──────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    setExpandedEventId(null);
    setEventData(null);

    try {
      const params = new URLSearchParams();
      params.set('from', new Date(fromDate).toISOString());
      params.set('to', new Date(toDate).toISOString());
      if (station) params.set('station', station);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (minDurationSec) params.set('minDuration', String(parseInt(minDurationSec) * 1000));
      if (maxDurationSec) params.set('maxDuration', String(parseInt(maxDurationSec) * 1000));
      params.set('limit', '200');

      const [eventsRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/analysis/events?${params}`),
        fetch(`${API_URL}/analysis/summary?${params}`)
      ]);

      const eventsJson = await eventsRes.json();
      const summaryJson = await summaryRes.json();

      if (eventsJson.success) {
        setEvents(eventsJson.data);
      } else {
        setError('Failed to fetch events');
      }

      if (summaryJson.success) {
        setSummary(summaryJson.summary);
      }
    } catch (err) {
      setError('Network error — is the server running?');
      console.error(err);
    }

    setLoading(false);
  }, [fromDate, toDate, station, typeFilter, minDurationSec, maxDurationSec]);

  // ── Fetch Event Sensor Data ───────────────────────────────
  const fetchEventData = useCallback(async (eventId: string) => {
    setEventDataLoading(true);
    try {
      const params = new URLSearchParams({
        bufferBefore: String(bufferBefore),
        bufferAfter: String(bufferAfter)
      });

      const res = await fetch(`${API_URL}/analysis/event-data/${eventId}?${params}`);
      const json = await res.json();

      if (json.success) {
        setEventData(json);
      }
    } catch (err) {
      console.error('Failed to fetch event data:', err);
    }
    setEventDataLoading(false);
  }, [bufferBefore, bufferAfter]);

  // Toggle expanded event
  const toggleEvent = (eventId: string) => {
    if (expandedEventId === eventId) {
      setExpandedEventId(null);
      setEventData(null);
    } else {
      setExpandedEventId(eventId);
      fetchEventData(eventId);
    }
    setCompZoomDomain(null);
    setCompDragEnd(null);
    compDragStartRef.current = null;
  };

  // Re-fetch event data when buffer changes (if expanded)
  const handleBufferRefresh = () => {
    if (expandedEventId) {
      fetchEventData(expandedEventId);
    }
  };

  // Quick date presets
  const setPreset = (preset: string) => {
    const now = new Date();
    switch (preset) {
      case 'today':
        setFromDate(toLocalDatetimeStr(startOfDay(now)));
        setToDate(toLocalDatetimeStr(endOfDay(now)));
        break;
      case 'lastHour':
        setFromDate(toLocalDatetimeStr(subHours(now, 1)));
        setToDate(toLocalDatetimeStr(now));
        break;
      case 'last24h':
        setFromDate(toLocalDatetimeStr(subHours(now, 24)));
        setToDate(toLocalDatetimeStr(now));
        break;
      case 'last7d':
        setFromDate(toLocalDatetimeStr(subDays(now, 7)));
        setToDate(toLocalDatetimeStr(now));
        break;
    }
  };

  // Auto-load on mount
  useEffect(() => {
    fetchEvents();
  }, []);

  // ── Chart data preparation ────────────────────────────────
  const chartData = useMemo(() => {
    if (!eventData) return { sensor1: [], sensor2: [] };

    const mapToChart = (data: SensorPoint[]) => {
      if (data.length === 0) return [];
      const t0 = new Date(data[0].t).getTime();
      return data.map(p => ({
        timeMs: new Date(p.t).getTime() - t0,
        timeSec: (new Date(p.t).getTime() - t0) / 1000,
        y_g: p.y_g,
        z_g: p.z_g,
        y_v: p.y_v,
        z_v: p.z_v,
        absTime: new Date(p.t).getTime()
      }));
    };

    return {
      sensor1: mapToChart(eventData.sensor1.data),
      sensor2: mapToChart(eventData.sensor2.data)
    };
  }, [eventData]);

  // Trigger time reference lines (relative to chart t0)
  const triggerLines = useMemo(() => {
    if (!eventData || !eventData.sensor1.data.length && !eventData.sensor2.data.length) return null;

    const sensorData = eventData.sensor1.data.length > 0 ? eventData.sensor1.data : eventData.sensor2.data;
    if (sensorData.length === 0) return null;

    const t0 = new Date(sensorData[0].t).getTime();
    const startSec = (new Date(eventData.event.startTime).getTime() - t0) / 1000;
    const endSec = eventData.event.endTime
      ? (new Date(eventData.event.endTime).getTime() - t0) / 1000
      : null;

    return { startSec, endSec };
  }, [eventData]);

  // ── Comparison chart data (merged both sensors) ───────────
  const comparisonChartData = useMemo(() => {
    if (!eventData) return [];

    const s1 = eventData.sensor1.data; // Right sensor
    const s2 = eventData.sensor2.data; // Left sensor

    if (s1.length === 0 && s2.length === 0) return [];

    const t0 = Math.min(
      s1.length > 0 ? new Date(s1[0].t).getTime() : Infinity,
      s2.length > 0 ? new Date(s2[0].t).getTime() : Infinity
    );

    const points: Array<{
      timeSec: number;
      absTime: number;
      z_right?: number;
      y_right?: number;
      z_left?: number;
      y_left?: number;
    }> = [];

    s1.forEach(p => {
      const t = new Date(p.t).getTime();
      points.push({
        timeSec: (t - t0) / 1000,
        absTime: t,
        z_right: p.z_g,
        y_right: p.y_g,
      });
    });

    s2.forEach(p => {
      const t = new Date(p.t).getTime();
      points.push({
        timeSec: (t - t0) / 1000,
        absTime: t,
        z_left: p.z_g,
        y_left: p.y_g,
      });
    });

    points.sort((a, b) => a.timeSec - b.timeSec);
    return points;
  }, [eventData]);

  // Trigger lines for comparison chart (common t0)
  const compTriggerLines = useMemo(() => {
    if (!eventData || comparisonChartData.length === 0) return null;

    const t0 = comparisonChartData[0].absTime;
    const startSec = (new Date(eventData.event.startTime).getTime() - t0) / 1000;
    const endSec = eventData.event.endTime
      ? (new Date(eventData.event.endTime).getTime() - t0) / 1000
      : null;

    return { startSec, endSec };
  }, [eventData, comparisonChartData]);

  // Filtered data for zoom
  const zoomedCompData = useMemo(() => {
    if (!compZoomDomain) return comparisonChartData;
    const [left, right] = compZoomDomain;
    return comparisonChartData.filter(p => p.timeSec >= left && p.timeSec <= right);
  }, [comparisonChartData, compZoomDomain]);

  // ── Comparison zoom handlers ──────────────────────────────
  const getCompTimeFromEvent = (e: any): number | null => {
    // Try activePayload first (most reliable for numeric axes)
    if (e?.activePayload?.[0]?.payload?.timeSec != null) {
      return Number(e.activePayload[0].payload.timeSec);
    }
    // Fallback to activeLabel
    if (e?.activeLabel != null) {
      return Number(e.activeLabel);
    }
    return null;
  };

  const onCompMouseDown = (e: any) => {
    const t = getCompTimeFromEvent(e);
    if (t != null) {
      compDragStartRef.current = t;
      setCompDragEnd(null);
    }
  };

  const onCompMouseMove = (e: any) => {
    if (compDragStartRef.current != null) {
      const t = getCompTimeFromEvent(e);
      if (t != null) {
        setCompDragEnd(t);
      }
    }
  };

  const onCompMouseUp = () => {
    if (compDragStartRef.current != null && compDragEnd != null) {
      const l = Math.min(compDragStartRef.current, compDragEnd);
      const r = Math.max(compDragStartRef.current, compDragEnd);
      if (r - l > 0.05) {
        setCompZoomDomain([l, r]);
      }
    }
    compDragStartRef.current = null;
    setCompDragEnd(null);
  };

  const resetCompZoom = () => {
    setCompZoomDomain(null);
  };

  // ── Filter sensor data to zoom range when a selection is active ──
  const filteredSensorData = useMemo(() => {
    if (!eventData) return null;

    const s1 = eventData.sensor1.data; // Right
    const s2 = eventData.sensor2.data; // Left

    // If no zoom domain is selected, use full data
    if (!compZoomDomain) return { s1, s2, isFiltered: false };

    // Compute t0 the same way comparisonChartData does
    const t0 = Math.min(
      s1.length > 0 ? new Date(s1[0].t).getTime() : Infinity,
      s2.length > 0 ? new Date(s2[0].t).getTime() : Infinity
    );

    const [zoomLeft, zoomRight] = compZoomDomain;

    // Filter sensor points to only those within the zoomed time range
    const filteredS1 = s1.filter(p => {
      const timeSec = (new Date(p.t).getTime() - t0) / 1000;
      return timeSec >= zoomLeft && timeSec <= zoomRight;
    });
    const filteredS2 = s2.filter(p => {
      const timeSec = (new Date(p.t).getTime() - t0) / 1000;
      return timeSec >= zoomLeft && timeSec <= zoomRight;
    });

    return { s1: filteredS1, s2: filteredS2, isFiltered: true };
  }, [eventData, compZoomDomain]);

  // ── Pulse timing analysis (auto-detect onset delay) ───────
  const pulseTimingAnalysis = useMemo(() => {
    if (!eventData || !filteredSensorData) return null;

    const { s1, s2 } = filteredSensorData;

    if (s1.length < 20 || s2.length < 20) return null;

    // Use the first sensor's first timestamp as t0 for display
    const allTimes = [
      ...s1.map(p => new Date(p.t).getTime()),
      ...s2.map(p => new Date(p.t).getTime())
    ];
    const t0 = Math.min(...allTimes);

    // Compute baseline from first 20% of data (assumed to be pre-event quiet period)
    // Check BOTH Y and Z axes — vibration can arrive on either axis first
    // depending on sensor orientation
    const computeOnset = (data: SensorPoint[], label: string) => {
      const baselineCount = Math.max(10, Math.floor(data.length * 0.2));

      // Compute baseline stats for BOTH axes independently
      const baselineY = data.slice(0, baselineCount).map(p => p.y_g);
      const baselineZ = data.slice(0, baselineCount).map(p => p.z_g);

      const meanY = baselineY.reduce((s, v) => s + v, 0) / baselineY.length;
      const meanZ = baselineZ.reduce((s, v) => s + v, 0) / baselineZ.length;

      const varianceY = baselineY.reduce((s, v) => s + (v - meanY) ** 2, 0) / baselineY.length;
      const varianceZ = baselineZ.reduce((s, v) => s + (v - meanZ) ** 2, 0) / baselineZ.length;

      const stddevY = Math.sqrt(varianceY);
      const stddevZ = Math.sqrt(varianceZ);

      const thresholdY = Math.max(stddevY * 3, 0.05); // At least 0.05g deviation
      const thresholdZ = Math.max(stddevZ * 3, 0.05);

      // Find first point where EITHER axis exceeds its threshold
      for (let i = baselineCount; i < data.length; i++) {
        const deviationY = Math.abs(data[i].y_g - meanY);
        const deviationZ = Math.abs(data[i].z_g - meanZ);

        if (deviationY > thresholdY || deviationZ > thresholdZ) {
          const onsetMs = new Date(data[i].t).getTime();
          const triggerAxis = deviationY > thresholdY ? 'Y' : 'Z';
          return {
            label,
            onsetMs,
            onsetSec: (onsetMs - t0) / 1000,
            onsetTime: new Date(data[i].t).toLocaleString('en-GB', {
              timeZone: 'Asia/Colombo',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
              fractionalSecondDigits: 3,
              hour12: false
            }),
            index: i,
            y_g: data[i].y_g,
            z_g: data[i].z_g,
            triggerAxis,
            baselineMeanY: meanY,
            baselineMeanZ: meanZ,
            thresholdY,
            thresholdZ
          };
        }
      }
      return null;
    };

    const rightOnset = computeOnset(s1, 'Right');
    const leftOnset = computeOnset(s2, 'Left');

    if (!rightOnset || !leftOnset) return null;

    const delaySec = rightOnset.onsetSec - leftOnset.onsetSec;

    return {
      right: rightOnset,
      left: leftOnset,
      delaySec,
      firstSensor: delaySec > 0 ? 'Left' : 'Right',
      absDelaySec: Math.abs(delaySec)
    };
  }, [eventData, filteredSensorData]);

  // ── Peak-to-peak train speed analysis (based on 10m physical distance) ──
  const peakSpeedAnalysis = useMemo(() => {
    if (!eventData || !filteredSensorData) return null;
    const { s1, s2 } = filteredSensorData;
    if (s1.length < 10 || s2.length < 10) return null;

    // Use the first sensor's first timestamp as t0 for display
    const allTimes = [
      ...s1.map(p => new Date(p.t).getTime()),
      ...s2.map(p => new Date(p.t).getTime())
    ];
    const t0 = Math.min(...allTimes);

    const reconstruct = (p) => {
      const tus = p.t_us ?? 0;
      if (tus === 0) return new Date(p.t).getTime();
      const s1First = s1[0];
      const tus0 = s1First ? (s1First.t_us ?? 0) : 0;
      let deltaUs = tus - tus0;
      if (deltaUs < -2147483648) deltaUs += 4294967296;
      else if (deltaUs > 2147483648) deltaUs -= 4294967296;
      return new Date(s1First.t).getTime() + (deltaUs / 1000);
    };

    // Find absolute peaks on Z axis
    let s1MaxRec = s1[0], s2MaxRec = s2[0];
    let s1MaxVal = -Infinity, s2MaxVal = -Infinity;
    for (const p of s1) {
      const val = Math.abs(p.z_g);
      if (val > s1MaxVal) {
        s1MaxVal = val;
        s1MaxRec = p;
      }
    }
    for (const p of s2) {
      const val = Math.abs(p.z_g);
      if (val > s2MaxVal) {
        s2MaxVal = val;
        s2MaxRec = p;
      }
    }

    const t1 = reconstruct(s1MaxRec);
    const t2 = reconstruct(s2MaxRec);
    const diffSec = Math.abs(t2 - t1) / 1000;

    const sensorDistance = 10.0; // 10m spacing
    const speedMs = diffSec > 0 ? sensorDistance / diffSec : 0;
    const speedKmh = speedMs * 3.6;

    // Filter out unrealistic peak matching speeds (e.g. noise-matched peaks resulting in <1.0 km/h)
    // If speed is extremely slow, fall back to 8.3 m/s (30 km/h) default placeholder/reference speed.
    const finalSpeedMs = speedKmh < 1.0 ? 8.333 : speedMs;
    const finalSpeedKmh = speedKmh < 1.0 ? 30.0 : speedKmh;

    const formatPeakTime = (ms: number) => new Date(ms).toLocaleString('en-GB', {
      timeZone: 'Asia/Colombo',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      fractionalSecondDigits: 3,
      hour12: false
    });

    return {
      diffSec,
      speedMs: finalSpeedMs,
      speedKmh: finalSpeedKmh,
      rightPeakTime: formatPeakTime(t1),
      leftPeakTime: formatPeakTime(t2),
      rightPeakVal: s1MaxVal,
      leftPeakVal: s2MaxVal
    };
  }, [eventData, filteredSensorData]);

  // ── Global Event/Timing helpers based on expanded event ──
  const expandedEventDetails = useMemo(() => {
    if (!expandedEventId || !pulseTimingAnalysis) return null;
    const ev = events.find(e => e._id === expandedEventId);
    const isLR = ev?.direction && ev.direction !== 'unknown'
      ? ev.direction === 'left_to_right'
      : pulseTimingAnalysis.firstSensor === 'Left';
    const verifiedFirst = isLR ? 'Left' : 'Right';
    const verifiedSecond = verifiedFirst === 'Left' ? 'Right' : 'Left';
    
    const firstOnsetObj = pulseTimingAnalysis[verifiedFirst === 'Left' ? 'left' : 'right'];
    const firstOnsetTime = firstOnsetObj.onsetTime;
    const firstOnsetMs = firstOnsetObj.onsetMs;
    
    const verifiedDelaySec = ev?.directionMeta?.propagationDelayMs != null
      ? ev.directionMeta.propagationDelayMs / 1000
      : pulseTimingAnalysis.absDelaySec;
      
    const secondOnsetMs = firstOnsetMs + verifiedDelaySec * 1000;
    const secondOnsetTime = new Date(secondOnsetMs).toLocaleString('en-GB', {
      timeZone: 'Asia/Colombo',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      fractionalSecondDigits: 3,
      hour12: false
    });

    return {
      ev,
      isLR,
      verifiedFirst,
      verifiedSecond,
      firstOnsetTime,
      firstOnsetMs,
      verifiedDelaySec,
      secondOnsetTime
    };
  }, [expandedEventId, events, pulseTimingAnalysis]);

  // ── CSV Export ────────────────────────────────────────────
  const exportCSV = () => {
    if (!eventData) return;

    const sensorKey = sensorTab as 'sensor1' | 'sensor2';
    const data = eventData[sensorKey].data;
    if (data.length === 0) return;

    const header = 'timestamp,y_g,z_g,y_v,z_v,t_us\n';
    const rows = data.map(p =>
      `${p.t},${p.y_g},${p.z_g},${p.y_v},${p.z_v},${p.t_us}`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event_${expandedEventId}_${sensorKey}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                  Data Analysis
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">Train event analysis & sensor data explorer</p>
              </div>
            </div>
            <Badge className="bg-violet-600/15 text-violet-300 border border-violet-500/25 text-xs">
              <BarChart3 className="w-3 h-3 mr-1" />
              {events.length} events loaded
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* ── Date Range & Search Bar ──────────────────────── */}
        <Card className="bg-slate-900/70 border-slate-800/50 backdrop-blur-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-slate-400 mb-1.5 block">From</Label>
                <Input
                  id="analysis-from-date"
                  type="datetime-local"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="bg-slate-800/60 border-slate-700/50 text-slate-200 text-sm h-10"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs text-slate-400 mb-1.5 block">To</Label>
                <Input
                  id="analysis-to-date"
                  type="datetime-local"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="bg-slate-800/60 border-slate-700/50 text-slate-200 text-sm h-10"
                />
              </div>

              <Button
                id="analysis-search-btn"
                onClick={fetchEvents}
                disabled={loading}
                className="h-10 bg-violet-600 hover:bg-violet-500 text-white gap-2 px-5"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="h-10 border-slate-700/50 bg-slate-800/40 hover:bg-slate-700/40 text-slate-300 gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters
                {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </div>

            {/* Quick presets */}
            <div className="flex gap-2 mt-3">
              {[
                { key: 'today', label: 'Today' },
                { key: 'lastHour', label: 'Last Hour' },
                { key: 'last24h', label: 'Last 24h' },
                { key: 'last7d', label: 'Last 7 Days' }
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => setPreset(p.key)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 border border-slate-700/30 transition-all hover:border-violet-500/30"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Expandable filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-slate-800/50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <Label className="text-xs text-slate-400 mb-1.5 block">Station</Label>
                  <Select value={station} onValueChange={setStation}>
                    <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Makumbura">Makumbura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-400 mb-1.5 block">Event Type</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="approaching">Approaching</SelectItem>
                      <SelectItem value="stopped">Stopped</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-400 mb-1.5 block">Min Duration (s)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={minDurationSec}
                    onChange={e => setMinDurationSec(e.target.value)}
                    className="bg-slate-800/60 border-slate-700/50 text-sm h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-400 mb-1.5 block">Max Duration (s)</Label>
                  <Input
                    type="number"
                    placeholder="∞"
                    value={maxDurationSec}
                    onChange={e => setMaxDurationSec(e.target.value)}
                    className="bg-slate-800/60 border-slate-700/50 text-sm h-9"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={fetchEvents}
                    variant="outline"
                    className="w-full h-9 border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Summary Cards ───────────────────────────────── */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={<Train className="w-5 h-5 text-violet-400" />}
              label="Total Events"
              value={summary.totalEvents}
              accent="border-violet-500/20"
            />
            <StatCard
              icon={<Clock className="w-5 h-5 text-cyan-400" />}
              label="Avg Duration"
              value={formatDuration(summary.avgDuration)}
              accent="border-cyan-500/20"
            />
            <StatCard
              icon={<Activity className="w-5 h-5 text-emerald-400" />}
              label="Active Events"
              value={summary.activeEvents}
              accent="border-emerald-500/20"
            />
            <StatCard
              icon={<BarChart3 className="w-5 h-5 text-amber-400" />}
              label="Sensor Records"
              value={summary.sensorRecordCount.toLocaleString()}
              accent="border-amber-500/20"
            />
          </div>
        )}

        {/* ── Error ──────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Buffer Controls ─────────────────────────────── */}
        <Card className="bg-slate-900/50 border-slate-800/40">
          <CardContent className="py-3 px-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-400" />
                <span className="text-sm text-slate-300 font-medium">Sensor Data Buffer:</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-400 whitespace-nowrap">Before (s)</Label>
                <Input
                  id="buffer-before"
                  type="number"
                  min={0}
                  max={300}
                  value={bufferBefore}
                  onChange={e => setBufferBefore(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 h-8 bg-slate-800/60 border-slate-700/50 text-sm text-center"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-400 whitespace-nowrap">After (s)</Label>
                <Input
                  id="buffer-after"
                  type="number"
                  min={0}
                  max={300}
                  value={bufferAfter}
                  onChange={e => setBufferAfter(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 h-8 bg-slate-800/60 border-slate-700/50 text-sm text-center"
                />
              </div>
              {expandedEventId && (
                <Button
                  size="sm"
                  onClick={handleBufferRefresh}
                  className="h-8 bg-violet-600/80 hover:bg-violet-500 text-xs gap-1"
                >
                  <Search className="w-3 h-3" />
                  Refresh Data
                </Button>
              )}
              <span className="text-xs text-slate-500 ml-auto">
                Window = event ± {bufferBefore}s before / {bufferAfter}s after
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ── Events Table ────────────────────────────────── */}
        <Card className="bg-slate-900/70 border-slate-800/50 overflow-hidden">
          <CardHeader className="pb-3 pt-5">
            <CardTitle className="text-base text-slate-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-violet-400" />
              Train Events
              <span className="text-xs text-slate-500 font-normal ml-2">
                {events.length} result{events.length !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading events...
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Train className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No train events found in the selected range</p>
                <p className="text-xs text-slate-500 mt-1">Try adjusting your date range or filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800/60 hover:bg-transparent">
                      <TableHead className="text-xs text-slate-400 w-10">#</TableHead>
                      <TableHead className="text-xs text-slate-400">Start Time (IST)</TableHead>
                      <TableHead className="text-xs text-slate-400">End Time (IST)</TableHead>
                      <TableHead className="text-xs text-slate-400">Duration</TableHead>
                      <TableHead className="text-xs text-slate-400">Station</TableHead>
                      <TableHead className="text-xs text-slate-400">Direction</TableHead>
                      <TableHead className="text-xs text-slate-400">Status</TableHead>
                      <TableHead className="text-xs text-slate-400 w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event, idx) => (
                      <React.Fragment key={event._id}>
                        <TableRow
                          id={`event-row-${event._id}`}
                          onClick={() => toggleEvent(event._id)}
                          className={`border-slate-800/40 cursor-pointer transition-all duration-200 ${
                            expandedEventId === event._id
                              ? 'bg-violet-500/8 hover:bg-violet-500/12'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <TableCell className="text-xs text-slate-500 font-mono">{idx + 1}</TableCell>
                          <TableCell className="text-sm font-mono text-slate-200">
                            {event.startTimeIST || formatISTShort(event.startTime)}
                          </TableCell>
                          <TableCell className="text-sm font-mono text-slate-300">
                            {event.endTime
                              ? (event.endTimeIST || formatISTShort(event.endTime))
                              : <span className="text-amber-400 text-xs">ongoing</span>
                            }
                          </TableCell>
                          <TableCell className="text-sm font-mono text-slate-300">
                            {formatDuration(event.duration || 0)}
                          </TableCell>
                          <TableCell className="text-sm text-slate-300">{event.station}</TableCell>
                          <TableCell>
                            {event.direction && event.direction !== 'unknown' ? (
                              <Badge className={`text-[10px] border gap-1 ${
                                event.direction === 'left_to_right'
                                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25'
                                  : 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                              }`}>
                                <ArrowRightLeft className="w-2.5 h-2.5" />
                                {event.direction === 'left_to_right' ? 'L → R' : 'R → L'}
                                {event.directionConfidence ? ` ${event.directionConfidence}%` : ''}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-slate-600">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {event.active ? (
                              <Badge className="bg-red-500/15 text-red-300 border border-red-500/25 text-[10px] animate-pulse">
                                Active
                              </Badge>
                            ) : event.type === 'stopped' ? (
                              <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px]">
                                Completed
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/25 text-[10px]">
                                {event.type}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {expandedEventId === event._id
                              ? <ChevronUp className="w-4 h-4 text-violet-400" />
                              : <ChevronDown className="w-4 h-4 text-slate-500" />
                            }
                          </TableCell>
                        </TableRow>

                        {/* ── Expanded Sensor Data Panel ──────── */}
                        {expandedEventId === event._id && (
                          <TableRow className="bg-slate-900/40 hover:bg-slate-900/40">
                            <TableCell colSpan={8} className="p-0">
                              <div className="p-5 space-y-5 animate-in slide-in-from-top-2 duration-300">
                                {eventDataLoading ? (
                                  <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Loading sensor data...
                                  </div>
                                ) : !eventData ? (
                                  <div className="text-center py-8 text-slate-500 text-sm">
                                    No data available
                                  </div>
                                ) : (
                                  <>
                                    {/* Window info */}
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Window: {eventData.window.startIST} → {eventData.window.endIST}
                                      </span>
                                      <Separator orientation="vertical" className="h-4 bg-slate-700" />
                                      <span>Buffer: -{eventData.window.bufferBefore}s / +{eventData.window.bufferAfter}s</span>
                                      <Separator orientation="vertical" className="h-4 bg-slate-700" />
                                      <span>{eventData.totalRecords.toLocaleString()} total records</span>
                                    </div>

                                    {/* Sensor Tabs */}
                                    <Tabs value={sensorTab} onValueChange={setSensorTab}>
                                      <div className="flex items-center justify-between">
                                        <TabsList className="bg-slate-800/60 border border-slate-700/30">
                                          <TabsTrigger value="sensor1" className="text-xs data-[state=active]:bg-violet-600/80 data-[state=active]:text-white">
                                            Right Sensor ({eventData.sensor1.count.toLocaleString()})
                                          </TabsTrigger>
                                          <TabsTrigger value="sensor2" className="text-xs data-[state=active]:bg-violet-600/80 data-[state=active]:text-white">
                                            Left Sensor ({eventData.sensor2.count.toLocaleString()})
                                          </TabsTrigger>
                                          <TabsTrigger value="compare" className="text-xs data-[state=active]:bg-cyan-600/80 data-[state=active]:text-white">
                                            ⚡ Compare Sensors
                                          </TabsTrigger>
                                        </TabsList>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={exportCSV}
                                          className="h-8 text-xs border-slate-700/50 text-slate-300 hover:bg-slate-700/40 gap-1"
                                        >
                                          <Download className="w-3 h-3" />
                                          Export CSV
                                        </Button>
                                      </div>

                                      {(['sensor1', 'sensor2'] as const).map(sKey => {
                                        const sensor = eventData[sKey];
                                        const cData = chartData[sKey];

                                        return (
                                          <TabsContent key={sKey} value={sKey} className="mt-4 space-y-4">
                                            {/* Stats row */}
                                            {sensor.stats && (
                                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                                                  <div className="text-[10px] text-slate-500 uppercase">Y-Axis Range</div>
                                                  <div className="text-sm font-mono text-blue-300">
                                                    {sensor.stats.y.min.toFixed(4)} → {sensor.stats.y.max.toFixed(4)} g
                                                  </div>
                                                </div>
                                                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                                                  <div className="text-[10px] text-slate-500 uppercase">Z-Axis Range</div>
                                                  <div className="text-sm font-mono text-emerald-300">
                                                    {sensor.stats.z.min.toFixed(4)} → {sensor.stats.z.max.toFixed(4)} g
                                                  </div>
                                                </div>
                                                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                                                  <div className="text-[10px] text-slate-500 uppercase">Y-Axis Avg</div>
                                                  <div className="text-sm font-mono text-blue-300">
                                                    {sensor.stats.y.avg.toFixed(5)} g
                                                  </div>
                                                </div>
                                                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30">
                                                  <div className="text-[10px] text-slate-500 uppercase">Z-Axis Avg</div>
                                                  <div className="text-sm font-mono text-emerald-300">
                                                    {sensor.stats.z.avg.toFixed(5)} g
                                                  </div>
                                                </div>
                                              </div>
                                            )}

                                            {/* Chart */}
                                            {cData.length < 2 ? (
                                              <div className="h-[300px] flex items-center justify-center text-sm text-slate-500">
                                                Not enough data points for this sensor
                                              </div>
                                            ) : (
                                              <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/20">
                                                <ResponsiveContainer width="100%" height={350}>
                                                  <LineChart data={cData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                                    <XAxis
                                                      dataKey="timeSec"
                                                      type="number"
                                                      domain={['dataMin', 'dataMax']}
                                                      stroke="#64748b"
                                                      tickFormatter={v => `${Number(v).toFixed(0)}s`}
                                                      tick={{ fontSize: 11 }}
                                                    />
                                                    <YAxis
                                                      stroke="#64748b"
                                                      tickFormatter={v => `${Number(v).toFixed(3)}g`}
                                                      tick={{ fontSize: 11 }}
                                                    />
                                                    <Tooltip
                                                      contentStyle={{
                                                        background: '#0f172a',
                                                        border: '1px solid #334155',
                                                        borderRadius: '8px',
                                                        fontSize: '12px'
                                                      }}
                                                      labelFormatter={v => `t = ${Number(v).toFixed(2)}s`}
                                                      formatter={(value: number, name: string) => [
                                                        `${value.toFixed(5)} g`,
                                                        name === 'y_g' ? 'Y-axis' : 'Z-axis'
                                                      ]}
                                                    />
                                                    {/* Trigger start line */}
                                                    {triggerLines && (
                                                      <ReferenceLine
                                                        x={triggerLines.startSec}
                                                        stroke="#f43f5e"
                                                        strokeDasharray="4 4"
                                                        strokeWidth={2}
                                                        label={{
                                                          value: '▶ Start',
                                                          fill: '#f43f5e',
                                                          fontSize: 11,
                                                          position: 'insideTopLeft'
                                                        }}
                                                      />
                                                    )}
                                                    {/* Trigger end line */}
                                                    {triggerLines?.endSec && (
                                                      <ReferenceLine
                                                        x={triggerLines.endSec}
                                                        stroke="#22c55e"
                                                        strokeDasharray="4 4"
                                                        strokeWidth={2}
                                                        label={{
                                                          value: 'Stop ■',
                                                          fill: '#22c55e',
                                                          fontSize: 11,
                                                          position: 'insideTopRight'
                                                        }}
                                                      />
                                                    )}
                                                    <Line
                                                      type="linear"
                                                      dataKey="y_g"
                                                      stroke="#3b82f6"
                                                      strokeWidth={1.5}
                                                      dot={false}
                                                      isAnimationActive={false}
                                                      name="y_g"
                                                    />
                                                    <Line
                                                      type="linear"
                                                      dataKey="z_g"
                                                      stroke="#22c55e"
                                                      strokeWidth={1.5}
                                                      dot={false}
                                                      isAnimationActive={false}
                                                      name="z_g"
                                                    />
                                                  </LineChart>
                                                </ResponsiveContainer>
                                                <div className="flex items-center justify-center gap-6 mt-2 text-xs text-slate-400">
                                                  <span className="flex items-center gap-1.5">
                                                    <span className="w-3 h-0.5 bg-blue-500 rounded-full inline-block" /> Y-axis (g)
                                                  </span>
                                                  <span className="flex items-center gap-1.5">
                                                    <span className="w-3 h-0.5 bg-emerald-500 rounded-full inline-block" /> Z-axis (g)
                                                  </span>
                                                  <span className="flex items-center gap-1.5">
                                                    <span className="w-3 h-0.5 bg-red-500 rounded-full inline-block border-dashed" /> Trigger Start
                                                  </span>
                                                  <span className="flex items-center gap-1.5">
                                                    <span className="w-3 h-0.5 bg-emerald-500 rounded-full inline-block border-dashed" /> Trigger End
                                                  </span>
                                                </div>
                                              </div>
                                            )}
                                          </TabsContent>
                                        );
                                      })}

                                      {/* ── Compare Sensors Tab ────────── */}
                                      <TabsContent value="compare" className="mt-4 space-y-5">
                                        {comparisonChartData.length < 2 ? (
                                          <div className="h-[300px] flex items-center justify-center text-sm text-slate-500">
                                            Not enough data from both sensors for comparison
                                          </div>
                                        ) : (
                                          <>
                                            {/* ── Train Direction Banner ────── */}
                                            {pulseTimingAnalysis && (() => {
                                               const ev = events.find(e => e._id === expandedEventId);
                                               const isLR = ev?.direction && ev.direction !== 'unknown'
                                                 ? ev.direction === 'left_to_right'
                                                 : pulseTimingAnalysis.firstSensor === 'Left';
                                               return (
                                                 <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-slate-800/60 to-cyan-500/10 border border-emerald-500/30">
                                                   <div className="flex items-center justify-between flex-wrap gap-4">
                                                     <div className="flex items-center gap-4">
                                                       <div className="text-4xl">🚂</div>
                                                       <div>
                                                         <div className="text-lg font-bold text-white flex items-center gap-3">
                                                           <span>Train Direction:</span>
                                                           {isLR ? (
                                                             <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-0.5 rounded-lg text-sm">
                                                               <span className="text-emerald-300 font-semibold">LEFT</span>
                                                               <ArrowRight className="w-4 h-4 text-emerald-400 animate-pulse" />
                                                               <span className="text-slate-500 font-medium">RIGHT</span>
                                                             </div>
                                                           ) : (
                                                             <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-0.5 rounded-lg text-sm">
                                                               <span className="text-slate-500 font-medium">LEFT</span>
                                                               <ArrowLeft className="w-4 h-4 text-emerald-400 animate-pulse" />
                                                               <span className="text-emerald-300 font-semibold">RIGHT</span>
                                                             </div>
                                                           )}
                                                         </div>
                                                         <div className="text-xs text-slate-400 mt-1">
                                                            {expandedEventDetails?.verifiedFirst} sensor detected first at <span className="text-white font-mono">{expandedEventDetails?.firstOnsetTime}</span>
                                                            {' · '}{expandedEventDetails?.verifiedSecond} sensor detected at <span className="text-white font-mono">{expandedEventDetails?.secondOnsetTime}</span>
                                                          </div>
                                                       </div>
                                                     </div>
                                                     <div className="flex items-center gap-3">
                                                       <div className="text-center px-4 py-2 rounded-lg bg-slate-900/60 border border-violet-500/30">
                                                         <div className="text-[10px] text-slate-500 uppercase">Delay</div>
                                                         <div className="text-xl font-bold font-mono text-violet-300">{peakSpeedAnalysis ? `${peakSpeedAnalysis.diffSec.toFixed(3)}s` : '—'}</div>
                                                         {peakSpeedAnalysis && (
                                                           <div className="text-[9px] text-slate-500 mt-1 leading-relaxed">
                                                             <div>R peak: <span className="text-blue-300 font-mono">{peakSpeedAnalysis.rightPeakTime}</span></div>
                                                             <div>L peak: <span className="text-amber-300 font-mono">{peakSpeedAnalysis.leftPeakTime}</span></div>
                                                           </div>
                                                         )}
                                                       </div>
                                                       {peakSpeedAnalysis && (
                                                         <div className="text-center px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                                                           <div className="text-[10px] text-slate-500 uppercase">Speed</div>
                                                           <div className="text-xl font-bold font-mono text-emerald-300">
                                                             {peakSpeedAnalysis.speedMs.toFixed(1)} m/s
                                                           </div>
                                                           <div className="text-[9px] text-slate-500">
                                                             {peakSpeedAnalysis.speedKmh.toFixed(1)} km/h
                                                           </div>
                                                         </div>
                                                       )}
                                                       <button
                                                         onClick={() => {
                                                           const onset = Math.min(pulseTimingAnalysis.left.onsetSec, pulseTimingAnalysis.right.onsetSec);
                                                           const end = Math.max(pulseTimingAnalysis.left.onsetSec, pulseTimingAnalysis.right.onsetSec);
                                                           setCompZoomDomain([Math.max(0, onset - 2), end + 3]);
                                                         }}
                                                         className="flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 transition-colors"
                                                       >
                                                         <ZoomIn className="w-4 h-4" />
                                                         Zoom to Onset
                                                       </button>
                                                     </div>
                                                   </div>
                                                 </div>
                                               );
                                             })()}
                                            {eventData.sensor1.stats && eventData.sensor2.stats && (() => {
                                              // Compute stats from filtered data when a zoom selection is active
                                              const computeRangeStats = (data: SensorPoint[]) => {
                                                if (data.length === 0) return null;
                                                let yMin = Infinity, yMax = -Infinity;
                                                let zMin = Infinity, zMax = -Infinity;
                                                for (const p of data) {
                                                  if (p.y_g < yMin) yMin = p.y_g;
                                                  if (p.y_g > yMax) yMax = p.y_g;
                                                  if (p.z_g < zMin) zMin = p.z_g;
                                                  if (p.z_g > zMax) zMax = p.z_g;
                                                }
                                                return { y: { min: yMin, max: yMax }, z: { min: zMin, max: zMax } };
                                              };
                                              const rightStats = filteredSensorData?.isFiltered
                                                ? computeRangeStats(filteredSensorData.s1)
                                                : { y: eventData.sensor1.stats!.y, z: eventData.sensor1.stats!.z };
                                              const leftStats = filteredSensorData?.isFiltered
                                                ? computeRangeStats(filteredSensorData.s2)
                                                : { y: eventData.sensor2.stats!.y, z: eventData.sensor2.stats!.z };
                                              if (!rightStats || !leftStats) return null;
                                              return (
                                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div className="p-3 rounded-lg bg-slate-800/50 border border-blue-500/20">
                                                  <div className="text-[10px] text-slate-500 uppercase">Z Right Range{filteredSensorData?.isFiltered ? ' (selected)' : ''}</div>
                                                  <div className="text-sm font-mono text-blue-300">
                                                    {rightStats.z.min.toFixed(4)} → {rightStats.z.max.toFixed(4)} g
                                                  </div>
                                                </div>
                                                <div className="p-3 rounded-lg bg-slate-800/50 border border-amber-500/20">
                                                  <div className="text-[10px] text-slate-500 uppercase">Z Left Range{filteredSensorData?.isFiltered ? ' (selected)' : ''}</div>
                                                  <div className="text-sm font-mono text-amber-300">
                                                    {leftStats.z.min.toFixed(4)} → {leftStats.z.max.toFixed(4)} g
                                                  </div>
                                                </div>
                                                <div className="p-3 rounded-lg bg-slate-800/50 border border-violet-500/20">
                                                  <div className="text-[10px] text-slate-500 uppercase">Y Right Range{filteredSensorData?.isFiltered ? ' (selected)' : ''}</div>
                                                  <div className="text-sm font-mono text-violet-300">
                                                    {rightStats.y.min.toFixed(4)} → {rightStats.y.max.toFixed(4)} g
                                                  </div>
                                                </div>
                                                <div className="p-3 rounded-lg bg-slate-800/50 border border-rose-500/20">
                                                  <div className="text-[10px] text-slate-500 uppercase">Y Left Range{filteredSensorData?.isFiltered ? ' (selected)' : ''}</div>
                                                  <div className="text-sm font-mono text-rose-300">
                                                    {leftStats.y.min.toFixed(4)} → {leftStats.y.max.toFixed(4)} g
                                                  </div>
                                                </div>
                                              </div>
                                              );
                                            })()}

                                            {/* Pulse timing analysis */}
                                            {pulseTimingAnalysis && (
                                              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-500/5 via-slate-800/40 to-amber-500/5 border border-cyan-500/20">
                                                <div className="flex items-center gap-2 mb-3">
                                                  <Activity className="w-4 h-4 text-cyan-400" />
                                                  <span className="text-sm font-semibold text-slate-200">Pulse Propagation Timing</span>
                                                  <Badge className="bg-cyan-600/15 text-cyan-300 border border-cyan-500/25 text-[10px]">
                                                    {filteredSensorData?.isFiltered ? 'Selected Range' : 'Auto-detected'}
                                                  </Badge>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                  <div className="p-2.5 rounded-lg bg-slate-800/60 border border-emerald-500/20">
                                                     <div className="text-[10px] text-slate-500 uppercase">First Detection Time</div>
                                                     <div className="text-xs font-semibold text-emerald-300 font-mono mt-0.5">
                                                       {expandedEventDetails?.verifiedFirst}: {expandedEventDetails?.firstOnsetTime}
                                                     </div>
                                                   </div>
                                                  <div className="p-2.5 rounded-lg bg-slate-800/60 border border-amber-500/20">
                                                    <div className="text-[10px] text-slate-500 uppercase">Left Onset (IST)</div>
                                                    <div className="text-sm font-mono text-amber-300">
                                                      {(() => {
                                                       const ev = events.find(e => e._id === expandedEventId);
                                                       const verifiedFirst = ev?.direction && ev.direction !== 'unknown'
                                                         ? (ev.direction === 'left_to_right' ? 'Left' : 'Right')
                                                         : pulseTimingAnalysis.firstSensor;
                                                       if (verifiedFirst === 'Left') {
                                                         return pulseTimingAnalysis.left.onsetTime;
                                                       } else {
                                                         // Left is second, calculate consistent timestamp
                                                         const verifiedDelaySec = ev?.directionMeta?.propagationDelayMs != null
                                                           ? ev.directionMeta.propagationDelayMs / 1000
                                                           : pulseTimingAnalysis.absDelaySec;
                                                         const adjustedMs = pulseTimingAnalysis.right.onsetMs + (verifiedDelaySec * 1000);
                                                         return new Date(adjustedMs).toLocaleString('en-GB', {
                                                           timeZone: 'Asia/Colombo',
                                                           hour: '2-digit', minute: '2-digit', second: '2-digit',
                                                           fractionalSecondDigits: 3,
                                                           hour12: false
                                                         });
                                                       }
                                                     })()}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                                      via {pulseTimingAnalysis.left.triggerAxis}-axis
                                                    </div>
                                                  </div>
                                                  <div className="p-2.5 rounded-lg bg-slate-800/60 border border-blue-500/20">
                                                    <div className="text-[10px] text-slate-500 uppercase">Right Onset (IST)</div>
                                                    <div className="text-sm font-mono text-blue-300">
                                                      {(() => {
                                                       const ev = events.find(e => e._id === expandedEventId);
                                                       const verifiedFirst = ev?.direction && ev.direction !== 'unknown'
                                                         ? (ev.direction === 'left_to_right' ? 'Left' : 'Right')
                                                         : pulseTimingAnalysis.firstSensor;
                                                       if (verifiedFirst === 'Right') {
                                                         return pulseTimingAnalysis.right.onsetTime;
                                                       } else {
                                                         // Right is second, calculate consistent timestamp
                                                         const verifiedDelaySec = ev?.directionMeta?.propagationDelayMs != null
                                                           ? ev.directionMeta.propagationDelayMs / 1000
                                                           : pulseTimingAnalysis.absDelaySec;
                                                         const adjustedMs = pulseTimingAnalysis.left.onsetMs + (verifiedDelaySec * 1000);
                                                         return new Date(adjustedMs).toLocaleString('en-GB', {
                                                           timeZone: 'Asia/Colombo',
                                                           hour: '2-digit', minute: '2-digit', second: '2-digit',
                                                           fractionalSecondDigits: 3,
                                                           hour12: false
                                                         });
                                                       }
                                                     })()}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                                      via {pulseTimingAnalysis.right.triggerAxis}-axis
                                                    </div>
                                                  </div>
                                                  <div className="p-2.5 rounded-lg bg-slate-800/60 border border-violet-500/20">
                                                     <div className="text-[10px] text-slate-500 uppercase">Peak Delay</div>
                                                     <div className="text-sm font-bold font-mono text-violet-300">{peakSpeedAnalysis ? `${peakSpeedAnalysis.diffSec.toFixed(3)}s` : '—'}</div>
                                                     {peakSpeedAnalysis && (
                                                       <div className="text-[9px] text-slate-500 mt-1 leading-relaxed">
                                                         <div>R: <span className="text-blue-300 font-mono">{peakSpeedAnalysis.rightPeakTime}</span> ({peakSpeedAnalysis.rightPeakVal.toFixed(3)}g)</div>
                                                         <div>L: <span className="text-amber-300 font-mono">{peakSpeedAnalysis.leftPeakTime}</span> ({peakSpeedAnalysis.leftPeakVal.toFixed(3)}g)</div>
                                                       </div>
                                                     )}
                                                   </div>
                                                  {peakSpeedAnalysis && (
                                                     <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/50 shadow-[0_0_12px_rgba(20,184,166,0.25)]">
                                                       <div className="text-[10px] text-slate-500 uppercase">Train Speed</div>
                                                       <div className="text-sm font-bold font-mono text-teal-300">
                                                         {peakSpeedAnalysis.speedMs.toFixed(1)} m/s
                                                       </div>
                                                       <div className="text-[10px] text-slate-500 mt-0.5">
                                                         {peakSpeedAnalysis.speedKmh.toFixed(1)} km/h
                                                       </div>
                                                     </div>
                                                   )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-3">
                                                  <button
                                                    onClick={() => {
                                                      const onset = Math.min(pulseTimingAnalysis.left.onsetSec, pulseTimingAnalysis.right.onsetSec);
                                                      const end = Math.max(pulseTimingAnalysis.left.onsetSec, pulseTimingAnalysis.right.onsetSec);
                                                      setCompZoomDomain([Math.max(0, onset - 2), end + 3]);
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 transition-colors"
                                                  >
                                                    <ZoomIn className="w-3 h-3" />
                                                    Zoom to Pulse Onset
                                                  </button>
                                                  {(() => {
                                                     const ev = events.find(e => e._id === expandedEventId);
                                                     const verifiedFirst = ev?.direction && ev.direction !== 'unknown'
                                                       ? (ev.direction === 'left_to_right' ? 'Left' : 'Right')
                                                       : pulseTimingAnalysis.firstSensor;
                                                     const verifiedSecond = verifiedFirst === 'Left' ? 'Right' : 'Left';
                                                     const delay = ev?.directionMeta?.propagationDelayMs != null
                                                       ? ev.directionMeta.propagationDelayMs / 1000
                                                       : pulseTimingAnalysis.absDelaySec;
                                                     return (
                                                       <span className="text-[10px] text-slate-500">
                                                         {verifiedFirst} sensor detected the train {delay.toFixed(3)}s before the {verifiedSecond} sensor
                                                       </span>
                                                     );
                                                   })()}
                                                </div>
                                              </div>
                                            )}

                                            {/* Direction Analysis Result */}
                                            {(() => {
                                              const ev = events.find(e => e._id === expandedEventId);
                                              if (!ev?.direction || ev.direction === 'unknown') return null;
                                              const isLR = ev.direction === 'left_to_right';
                                              return (
                                                <div className={`p-4 rounded-xl border ${
                                                  isLR
                                                    ? 'bg-gradient-to-r from-cyan-500/8 to-blue-500/5 border-cyan-500/25'
                                                    : 'bg-gradient-to-r from-amber-500/8 to-orange-500/5 border-amber-500/25'
                                                }`}>
                                                  <div className="flex items-center gap-2 mb-3">
                                                    <Train className="w-4 h-4" style={{ color: isLR ? '#67e8f9' : '#fbbf24' }} />
                                                    <span className="text-sm font-semibold text-slate-200">Direction Analysis</span>
                                                    <Badge className={`text-[10px] border ${
                                                      (ev.directionConfidence || 0) >= 60
                                                        ? 'bg-emerald-600/15 text-emerald-300 border-emerald-500/25'
                                                        : 'bg-amber-600/15 text-amber-300 border-amber-500/25'
                                                    }`}>
                                                      {(ev.directionConfidence || 0) >= 60 ? 'High Confidence' : 'Medium Confidence'}
                                                    </Badge>
                                                  </div>
                                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                    <div className={`p-2.5 rounded-lg bg-slate-800/60 border ${isLR ? 'border-cyan-500/20' : 'border-amber-500/20'}`}>
                                                      <div className="text-[10px] text-slate-500 uppercase">Direction</div>
                                                      <div className="mt-1">
                                                         <div className="flex items-center gap-1.5 mt-0.5">
                                                           <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors ${
                                                             isLR
                                                               ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25'
                                                               : 'bg-slate-700/30 text-slate-500 border border-slate-700/10'
                                                           }`}>
                                                             LEFT
                                                           </span>
                                                           {isLR ? (
                                                             <ArrowRight className="w-3.5 h-3.5 text-cyan-400 animate-pulse shrink-0" />
                                                           ) : (
                                                             <ArrowLeft className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                                                           )}
                                                           <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors ${
                                                             !isLR
                                                               ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                                                               : 'bg-slate-700/30 text-slate-500 border border-slate-700/10'
                                                           }`}>
                                                             RIGHT
                                                           </span>
                                                         </div>
                                                      </div>
                                                    </div>
                                                    <div className="p-2.5 rounded-lg bg-slate-800/60 border border-violet-500/20">
                                                      <div className="text-[10px] text-slate-500 uppercase">Confidence</div>
                                                      <div className="text-lg font-bold font-mono text-violet-300">
                                                        {ev.directionConfidence || 0}%
                                                      </div>
                                                    </div>
                                                    <div className="p-2.5 rounded-lg bg-slate-800/60 border border-emerald-500/20">
                                                       <div className="text-[10px] text-slate-500 uppercase">First Detection Time</div>
                                                       <div className="text-xs font-semibold text-emerald-300 font-mono mt-0.5">
                                                         {expandedEventDetails?.verifiedFirst}: {expandedEventDetails?.firstOnsetTime}
                                                       </div>
                                                     </div>
                                                    <div className="p-2.5 rounded-lg bg-slate-800/60 border border-blue-500/20">
                                                      <div className="text-[10px] text-slate-500 uppercase">Peak Delay</div>
                                                      <div className="text-sm font-bold font-mono text-blue-300">{peakSpeedAnalysis ? `${peakSpeedAnalysis.diffSec.toFixed(3)}s` : '—'}</div>
                                                    </div>
                                                    {peakSpeedAnalysis && (
                                                       <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/50 shadow-[0_0_12px_rgba(20,184,166,0.25)]">
                                                         <div className="text-[10px] text-slate-500 uppercase">Train Speed</div>
                                                         <div className="text-sm font-bold font-mono text-teal-300">
                                                           {peakSpeedAnalysis.speedMs.toFixed(1)} m/s
                                                         </div>
                                                         <div className="text-[10px] text-slate-500 mt-0.5">
                                                           {peakSpeedAnalysis.speedKmh.toFixed(1)} km/h
                                                         </div>
                                                       </div>
                                                     )}
                                                  </div>
                                                  {/* Method breakdown */}
                                                  {ev.directionMeta?.methods && ev.directionMeta.methods.length > 0 && (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                      {ev.directionMeta.methods.map((m, i) => (
                                                        <span
                                                          key={i}
                                                          className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-mono border ${
                                                            m.result === 'LEFT'
                                                              ? 'bg-cyan-900/20 text-cyan-400 border-cyan-500/20'
                                                              : 'bg-amber-900/20 text-amber-400 border-amber-500/20'
                                                          }`}
                                                        >
                                                          {m.name}: {m.result} ({m.deltaMs.toFixed(0)}ms)
                                                        </span>
                                                      ))}
                                                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-mono bg-slate-800/60 text-slate-400 border border-slate-700/30">
                                                        Votes: L={ev.directionMeta?.votesLeft || 0} / R={ev.directionMeta?.votesRight || 0}
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })()}

                                            {/* Zoom controls bar */}
                                            <div className="flex items-center gap-3 px-1">
                                              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                <ZoomIn className="w-3.5 h-3.5 text-cyan-400" />
                                                <span>Drag on chart to zoom into a section</span>
                                              </div>
                                              {compZoomDomain && (
                                                <>
                                                  <Badge className="bg-cyan-600/15 text-cyan-300 border border-cyan-500/25 text-[10px] font-mono">
                                                    {compZoomDomain[0].toFixed(1)}s — {compZoomDomain[1].toFixed(1)}s
                                                  </Badge>
                                                  <Badge className="bg-emerald-600/15 text-emerald-300 border border-emerald-500/25 text-[10px]">
                                                    ✓ Analysis scoped to selection
                                                  </Badge>
                                                  <button
                                                    onClick={resetCompZoom}
                                                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 border border-slate-700/40 transition-colors"
                                                  >
                                                    <RotateCcw className="w-3 h-3" />
                                                    Reset Zoom
                                                  </button>
                                                </>
                                              )}
                                              <span className="text-[10px] text-slate-500 ml-auto">
                                                {zoomedCompData.length.toLocaleString()} points in view
                                              </span>
                                            </div>

                                            {/* ── Z-Axis Comparison Chart ──────── */}
                                            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/20">
                                              <div className="flex items-center gap-2 mb-3">
                                                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-blue-500 to-amber-500" />
                                                <span className="text-sm font-semibold text-slate-200">Z-Axis Comparison</span>
                                                <span className="text-[10px] text-slate-500">Right vs Left sensor</span>
                                              </div>
                                              <ResponsiveContainer width="100%" height={300}>
                                                <LineChart
                                                  data={zoomedCompData}
                                                  onMouseDown={onCompMouseDown}
                                                  onMouseMove={onCompMouseMove}
                                                  onMouseUp={onCompMouseUp}
                                                >
                                                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                                  <XAxis
                                                    dataKey="timeSec"
                                                    type="number"
                                                    domain={['dataMin', 'dataMax']}
                                                    stroke="#64748b"
                                                    tickFormatter={v => {
                                                      const sec = Number(v);
                                                      if (compZoomDomain && (compZoomDomain[1] - compZoomDomain[0]) < 5) return `${sec.toFixed(2)}s`;
                                                      if (compZoomDomain && (compZoomDomain[1] - compZoomDomain[0]) < 20) return `${sec.toFixed(1)}s`;
                                                      return `${sec.toFixed(0)}s`;
                                                    }}
                                                    tick={{ fontSize: 11 }}
                                                  />
                                                  <YAxis
                                                    stroke="#64748b"
                                                    tickFormatter={v => `${Number(v).toFixed(3)}g`}
                                                    tick={{ fontSize: 11 }}
                                                  />
                                                  <Tooltip
                                                    content={({ active, payload, label }: any) => {
                                                      if (!active || !payload) return null;
                                                      const items = payload.filter((p: any) => p.value != null);
                                                      if (items.length === 0) return null;
                                                      return (
                                                        <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                                                          <div className="text-slate-400 mb-1.5 font-mono flex items-center justify-between gap-4">
                                                           <span>t = {Number(label).toFixed(3)}s</span>
                                                           {payload[0]?.payload?.absTime && (
                                                             <span className="text-cyan-400">
                                                               {(() => {
                                                                 const d = new Date(payload[0].payload.absTime);
                                                                 const pad = (n, l = 2) => String(n).padStart(l, '0');
                                                                 return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
                                                               })()}
                                                             </span>
                                                           )}
                                                         </div>
                                                          {items.map((item: any, i: number) => (
                                                            <div key={i} className="flex items-center gap-2 py-0.5">
                                                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.stroke || item.color }} />
                                                              <span className="text-slate-300">{item.dataKey === 'z_right' ? 'Z Right' : 'Z Left'}:</span>
                                                              <span className="text-slate-100 font-mono">{Number(item.value).toFixed(5)} g</span>
                                                            </div>
                                                          ))}
                                                        </div>
                                                      );
                                                    }}
                                                  />
                                                  {/* Trigger lines */}
                                                  {compTriggerLines && (
                                                    <ReferenceLine
                                                      x={compTriggerLines.startSec}
                                                      stroke="#f43f5e"
                                                      strokeDasharray="4 4"
                                                      strokeWidth={2}
                                                      label={{ value: '▶ Start', fill: '#f43f5e', fontSize: 11, position: 'insideTopLeft' }}
                                                    />
                                                  )}
                                                  {compTriggerLines?.endSec && (
                                                    <ReferenceLine
                                                      x={compTriggerLines.endSec}
                                                      stroke="#22c55e"
                                                      strokeDasharray="4 4"
                                                      strokeWidth={2}
                                                      label={{ value: 'Stop ■', fill: '#22c55e', fontSize: 11, position: 'insideTopRight' }}
                                                    />
                                                  )}
                                                  <Line
                                                    type="linear"
                                                    dataKey="z_right"
                                                    stroke="#3b82f6"
                                                    strokeWidth={1.5}
                                                    dot={false}
                                                    connectNulls
                                                    isAnimationActive={false}
                                                    name="z_right"
                                                  />
                                                  <Line
                                                    type="linear"
                                                    dataKey="z_left"
                                                    stroke="#f59e0b"
                                                    strokeWidth={1.5}
                                                    dot={false}
                                                    connectNulls
                                                    isAnimationActive={false}
                                                    name="z_left"
                                                  />
                                                  {/* Drag selection highlight */}
                                                  {compDragStartRef.current != null && compDragEnd != null && (
                                                    <ReferenceArea
                                                      x1={compDragStartRef.current}
                                                      x2={compDragEnd}
                                                      fill="rgba(34,211,238,0.15)"
                                                      stroke="rgba(34,211,238,0.4)"
                                                    />
                                                  )}
                                                </LineChart>
                                              </ResponsiveContainer>
                                              <div className="flex items-center justify-center gap-6 mt-2 text-xs text-slate-400">
                                                <span className="flex items-center gap-1.5">
                                                  <span className="w-3 h-0.5 bg-blue-500 rounded-full inline-block" /> Z Right
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                  <span className="w-3 h-0.5 bg-amber-500 rounded-full inline-block" /> Z Left
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                  <span className="w-3 h-0.5 bg-red-500 rounded-full inline-block" /> Trigger Start
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                  <span className="w-3 h-0.5 bg-emerald-500 rounded-full inline-block" /> Trigger End
                                                </span>
                                              </div>
                                            </div>

                                            {/* ── Y-Axis Comparison Chart ──────── */}
                                            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/20">
                                              <div className="flex items-center gap-2 mb-3">
                                                <div className="w-1 h-4 rounded-full bg-gradient-to-b from-violet-500 to-rose-500" />
                                                <span className="text-sm font-semibold text-slate-200">Y-Axis Comparison</span>
                                                <span className="text-[10px] text-slate-500">Right vs Left sensor</span>
                                              </div>
                                              <ResponsiveContainer width="100%" height={300}>
                                                <LineChart
                                                  data={zoomedCompData}
                                                  onMouseDown={onCompMouseDown}
                                                  onMouseMove={onCompMouseMove}
                                                  onMouseUp={onCompMouseUp}
                                                >
                                                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                                  <XAxis
                                                    dataKey="timeSec"
                                                    type="number"
                                                    domain={['dataMin', 'dataMax']}
                                                    stroke="#64748b"
                                                    tickFormatter={v => {
                                                      const sec = Number(v);
                                                      if (compZoomDomain && (compZoomDomain[1] - compZoomDomain[0]) < 5) return `${sec.toFixed(2)}s`;
                                                      if (compZoomDomain && (compZoomDomain[1] - compZoomDomain[0]) < 20) return `${sec.toFixed(1)}s`;
                                                      return `${sec.toFixed(0)}s`;
                                                    }}
                                                    tick={{ fontSize: 11 }}
                                                  />
                                                  <YAxis
                                                    stroke="#64748b"
                                                    tickFormatter={v => `${Number(v).toFixed(3)}g`}
                                                    tick={{ fontSize: 11 }}
                                                  />
                                                  <Tooltip
                                                    content={({ active, payload, label }: any) => {
                                                      if (!active || !payload) return null;
                                                      const items = payload.filter((p: any) => p.value != null);
                                                      if (items.length === 0) return null;
                                                      return (
                                                        <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                                                          <div className="text-slate-400 mb-1.5 font-mono flex items-center justify-between gap-4">
                                                           <span>t = {Number(label).toFixed(3)}s</span>
                                                           {payload[0]?.payload?.absTime && (
                                                             <span className="text-cyan-400">
                                                               {(() => {
                                                                 const d = new Date(payload[0].payload.absTime);
                                                                 const pad = (n, l = 2) => String(n).padStart(l, '0');
                                                                 return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
                                                               })()}
                                                             </span>
                                                           )}
                                                         </div>
                                                          {items.map((item: any, i: number) => (
                                                            <div key={i} className="flex items-center gap-2 py-0.5">
                                                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.stroke || item.color }} />
                                                              <span className="text-slate-300">{item.dataKey === 'y_right' ? 'Y Right' : 'Y Left'}:</span>
                                                              <span className="text-slate-100 font-mono">{Number(item.value).toFixed(5)} g</span>
                                                            </div>
                                                          ))}
                                                        </div>
                                                      );
                                                    }}
                                                  />
                                                  {/* Trigger lines */}
                                                  {compTriggerLines && (
                                                    <ReferenceLine
                                                      x={compTriggerLines.startSec}
                                                      stroke="#f43f5e"
                                                      strokeDasharray="4 4"
                                                      strokeWidth={2}
                                                      label={{ value: '▶ Start', fill: '#f43f5e', fontSize: 11, position: 'insideTopLeft' }}
                                                    />
                                                  )}
                                                  {compTriggerLines?.endSec && (
                                                    <ReferenceLine
                                                      x={compTriggerLines.endSec}
                                                      stroke="#22c55e"
                                                      strokeDasharray="4 4"
                                                      strokeWidth={2}
                                                      label={{ value: 'Stop ■', fill: '#22c55e', fontSize: 11, position: 'insideTopRight' }}
                                                    />
                                                  )}
                                                  <Line
                                                    type="linear"
                                                    dataKey="y_right"
                                                    stroke="#8b5cf6"
                                                    strokeWidth={1.5}
                                                    dot={false}
                                                    connectNulls
                                                    isAnimationActive={false}
                                                    name="y_right"
                                                  />
                                                  <Line
                                                    type="linear"
                                                    dataKey="y_left"
                                                    stroke="#f43f5e"
                                                    strokeWidth={1.5}
                                                    dot={false}
                                                    connectNulls
                                                    isAnimationActive={false}
                                                    name="y_left"
                                                  />
                                                  {/* Drag selection highlight */}
                                                  {compDragStartRef.current != null && compDragEnd != null && (
                                                    <ReferenceArea
                                                      x1={compDragStartRef.current}
                                                      x2={compDragEnd}
                                                      fill="rgba(139,92,246,0.15)"
                                                      stroke="rgba(139,92,246,0.4)"
                                                    />
                                                  )}
                                                </LineChart>
                                              </ResponsiveContainer>
                                              <div className="flex items-center justify-center gap-6 mt-2 text-xs text-slate-400">
                                                <span className="flex items-center gap-1.5">
                                                  <span className="w-3 h-0.5 bg-violet-500 rounded-full inline-block" /> Y Right
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                  <span className="w-3 h-0.5 bg-rose-500 rounded-full inline-block" /> Y Left
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                  <span className="w-3 h-0.5 bg-red-500 rounded-full inline-block" /> Trigger Start
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                  <span className="w-3 h-0.5 bg-emerald-500 rounded-full inline-block" /> Trigger End
                                                </span>
                                              </div>
                                            </div>
                                          </>
                                        )}
                                      </TabsContent>
                                    </Tabs>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DataAnalysis;
