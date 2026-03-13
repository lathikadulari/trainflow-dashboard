import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Train, ArrowRight, ArrowLeft, Cpu, Activity, ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';

interface VoltageData {
    x: number;
    y: number;
    z: number;
}

interface SensorData {
    timestamp: number;
    x: number;
    y: number;
    z: number;
    magnitude: number;
    voltage: VoltageData;
}

interface TrainState {
    phase: string;
    direction: string | null;
    speed: number;
    isApproaching: boolean;
}

interface FFTPoint {
    frequency: number;
    magnitude: number;
}

interface FFTData {
    sensorA: { x: FFTPoint[]; y: FFTPoint[]; z: FFTPoint[] };
    sensorB: { x: FFTPoint[]; y: FFTPoint[]; z: FFTPoint[] };
}

interface ExpandedChartInfo {
    sensor: 'A' | 'B';
    axis: 'x' | 'y' | 'z';
    type: 'time' | 'fft';
}

// Y-axis scale presets for viewing small signals
const yAxisPresets = [
    { label: 'Auto', value: null },
    { label: '±5k', value: [-5000, 5000] },
    { label: '±10k', value: [-10000, 10000] },
    { label: '±20k', value: [-20000, 20000] },
    { label: '±50k', value: [-50000, 50000] },
    { label: '±70k', value: [-20000, 70000] },
];

const API_URL = 'http://localhost:5001/api';

// Axis configuration for consistent styling
const axisConfig = {
    x: { color: '#22d3ee', name: 'X-Axis', bgGradient: 'from-cyan-500/20' },
    y: { color: '#3b82f6', name: 'Y-Axis', bgGradient: 'from-blue-500/20' },
    z: { color: '#22c55e', name: 'Z-Axis', bgGradient: 'from-green-500/20' },
};

const sensorConfig = {
    A: { color: '#06b6d4', name: 'Sensor A', borderColor: 'border-cyan-500/30' },
    B: { color: '#d946ef', name: 'Sensor B', borderColor: 'border-fuchsia-500/30' },
};

const SensorSimulation = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [sensorAData, setSensorAData] = useState<SensorData[]>([]);
    const [sensorBData, setSensorBData] = useState<SensorData[]>([]);
    const [fftData, setFftData] = useState<FFTData | null>(null);
    const [trainState, setTrainState] = useState<TrainState>({
        phase: 'idle', direction: null, speed: 0, isApproaching: false,
    });
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected'>('disconnected');
    const [dataSource, setDataSource] = useState<'simulation' | 'esp32'>('simulation');
    const [esp32Status, setEsp32Status] = useState<'offline' | 'online'>('offline');

    // Expanded chart modal state
    const [expandedChart, setExpandedChart] = useState<ExpandedChartInfo | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [yAxisPresetIndex, setYAxisPresetIndex] = useState(0);
    const eventSourceRef = useRef<EventSource | null>(null);
    const fftIntervalRef = useRef<number | null>(null);
    const dataBufferRef = useRef<{ sensorA: SensorData[]; sensorB: SensorData[] }>({ sensorA: [], sensorB: [] });
    const animationFrameRef = useRef<number | null>(null);
    const lastUpdateRef = useRef<number>(0);
    const expandedChartRef = useRef<ExpandedChartInfo | null>(null);
    const maxDataPoints = 256;
    const sampleRate = 50;
    const latestTrainStateRef = useRef<TrainState | null>(null);

    // Keep ref in sync with state for use in callback
    useEffect(() => {
        expandedChartRef.current = expandedChart;
    }, [expandedChart]);

    // Throttled update function to batch data updates
    const flushDataToState = useCallback(() => {
        const now = performance.now();
        // Slower updates when modal is open to prevent flickering (300ms = ~3 FPS)
        const intervalMs = expandedChartRef.current ? 300 : 50;
        if (now - lastUpdateRef.current >= intervalMs) {
            const buffer = dataBufferRef.current;
            if (buffer.sensorA.length > 0) {
                setSensorAData(prev => [...prev, ...buffer.sensorA].slice(-maxDataPoints));
                setSensorBData(prev => [...prev, ...buffer.sensorB].slice(-maxDataPoints));
                dataBufferRef.current = { sensorA: [], sensorB: [] };
                lastUpdateRef.current = now;
            }
            // Update train state only during flush
            if (latestTrainStateRef.current) {
                setTrainState(latestTrainStateRef.current);
            }
        }
        animationFrameRef.current = requestAnimationFrame(flushDataToState);
    }, [maxDataPoints]);

    // Connect to local simulation stream
    const connectToStream = useCallback(() => {
        if (eventSourceRef.current) eventSourceRef.current.close();
        const eventSource = new EventSource(`${API_URL}/simulation/stream`);
        eventSourceRef.current = eventSource;
        eventSource.onopen = () => setConnectionStatus('connected');
        eventSource.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'data') {
                const { sensorA, sensorB, trainState: state } = message.data;
                // Buffer data instead of immediate state update
                dataBufferRef.current.sensorA.push(sensorA);
                dataBufferRef.current.sensorB.push(sensorB);
                // Store latest train state in ref, update will happen in flush
                latestTrainStateRef.current = state;
            } else if (message.type === 'status') {
                setIsRunning(message.data.isRunning);
            }
        };
        eventSource.onerror = () => { setConnectionStatus('disconnected'); eventSource.close(); };
    }, []);

    // Connect to ESP32 live data stream via MQTT
    const connectToESP32Stream = useCallback(() => {
        if (eventSourceRef.current) eventSourceRef.current.close();
        const eventSource = new EventSource(`${API_URL}/mqtt/stream`);
        eventSourceRef.current = eventSource;
        eventSource.onopen = () => setConnectionStatus('connected');
        eventSource.onmessage = (event) => {
            const message = JSON.parse(event.data);

            // Handle initial status
            if (message.type === 'status') {
                setEsp32Status(message.esp32Status || (message.connected ? 'online' : 'offline'));
                return;
            }

            // Handle periodic ESP32 heartbeat status
            if (message.type === 'esp32_status') {
                setEsp32Status(message.status);
                return;
            }

            const { topic, data } = message;

            if (topic === 'trainflow/sensor/A' && data) {
                dataBufferRef.current.sensorA.push(data);
            } else if (topic === 'trainflow/sensor/B' && data) {
                dataBufferRef.current.sensorB.push(data);
            } else if (topic === 'trainflow/trainState' && data) {
                latestTrainStateRef.current = data;
            }
        };
        eventSource.onerror = () => {
            setConnectionStatus('disconnected');
            setEsp32Status('offline');
            eventSource.close();
        };
    }, []);

    const fetchFFT = async () => {
        try {
            const response = await fetch(`${API_URL}/simulation/fft`);
            const result = await response.json();
            if (result.success && result.data) {
                setFftData(result.data);
            }
        } catch (error) {
            console.error('FFT fetch error:', error);
        }
    };

    const fetchMqttFFT = async () => {
        try {
            const response = await fetch(`${API_URL}/mqtt/fft`);
            const result = await response.json();
            if (result.success && result.data) {
                setFftData(result.data);
            }
        } catch (error) {
            console.error('MQTT FFT fetch error:', error);
        }
    };

    const startSimulation = async () => {
        if (dataSource === 'esp32') {
            // Connect to ESP32 live data
            setIsRunning(true);
            connectToESP32Stream();
            animationFrameRef.current = requestAnimationFrame(flushDataToState);
            // Poll FFT from MQTT buffer
            fftIntervalRef.current = window.setInterval(fetchMqttFFT, 500);
        } else {
            // Use local simulation
            await fetch(`${API_URL}/simulation/start`, { method: 'POST' });
            setIsRunning(true);
            connectToStream();
            animationFrameRef.current = requestAnimationFrame(flushDataToState);
            fftIntervalRef.current = window.setInterval(fetchFFT, 500);
        }
    };

    const stopSimulation = async () => {
        if (dataSource === 'simulation') {
            await fetch(`${API_URL}/simulation/stop`, { method: 'POST' });
        }
        setIsRunning(false);
        eventSourceRef.current?.close();
        if (fftIntervalRef.current) clearInterval(fftIntervalRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setConnectionStatus('disconnected');
        // Clear data when stopping
        setSensorAData([]);
        setSensorBData([]);
        setFftData(null);
    };

    const triggerTrain = async (direction?: string) => {
        if (dataSource === 'esp32') {
            // Send command to ESP32 via MQTT
            await fetch(`${API_URL}/mqtt/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: 'trainflow/command',
                    message: { command: 'trigger_train', direction }
                }),
            });
        } else {
            await fetch(`${API_URL}/simulation/trigger-train`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ direction }),
            });
        }
    };

    // Switch data source
    const switchDataSource = (source: 'simulation' | 'esp32') => {
        if (isRunning) {
            stopSimulation();
        }
        setDataSource(source);
    };

    useEffect(() => {
        return () => {
            eventSourceRef.current?.close();
            if (fftIntervalRef.current) clearInterval(fftIntervalRef.current);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);

    // Get latest voltage readings
    const latestVoltageA = sensorAData.length > 0 ? sensorAData[sensorAData.length - 1].voltage : { x: 1.65, y: 1.65, z: 1.65 };
    const latestVoltageB = sensorBData.length > 0 ? sensorBData[sensorBData.length - 1].voltage : { x: 1.65, y: 1.65, z: 1.65 };

    const getPhaseColor = (phase: string) => {
        switch (phase) {
            case 'approaching': return 'bg-yellow-500';
            case 'passing': return 'bg-red-500';
            case 'departing': return 'bg-orange-500';
            default: return 'bg-green-500';
        }
    };

    // Voltage bar component
    const VoltageBar = ({ voltage, color }: { voltage: number; color: string }) => {
        const percentage = (voltage / 3.3) * 100;
        return (
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                    className="h-full transition-all duration-100"
                    style={{ width: `${percentage}%`, backgroundColor: color }}
                />
            </div>
        );
    };

    // Time-domain chart component - Memoized to prevent unnecessary re-renders
    const TimeChart = React.memo(({
        data,
        axis,
        expanded = false,
        customYDomain = null
    }: {
        data: SensorData[];
        axis: 'x' | 'y' | 'z';
        expanded?: boolean;
        customYDomain?: [number, number] | null;
    }) => {
        const config = axisConfig[axis];

        // Memoize the prepared time data
        const timeData = useMemo(() =>
            data.map((d, i) => ({ time: i * (1000 / sampleRate), amplitude: d[axis] })),
            [data, axis]
        );

        // Memoize domain to prevent axis flickering
        const yDomain = useMemo(() => customYDomain || [-20000, 70000] as [number, number], [customYDomain]);

        const height = expanded ? 350 : 100;
        const fontSize = expanded ? 11 : 9;

        // Don't render chart if no data - prevents flash of empty chart
        if (data.length < 2) {
            return (
                <div className={`h-[${height}px] flex items-center justify-center text-gray-500 text-xs`}>
                    Waiting for data...
                </div>
            );
        }

        if (expanded) {
            return (
                <div className="h-[400px] w-full overflow-auto">
                    <LineChart width={900} height={500} data={timeData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="time" stroke="#666" fontSize={fontSize} tickFormatter={v => `${(v / 1000).toFixed(1)}s`} />
                        <YAxis stroke="#666" fontSize={fontSize} domain={yDomain} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                        <Line type="monotone" dataKey="amplitude" stroke={config.color} strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                </div>
            );
        }

        return (
            <div className="h-[100px] w-full">
                <LineChart width={450} height={100} data={timeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="time" stroke="#666" fontSize={9} tickFormatter={v => `${(v / 1000).toFixed(1)}s`} />
                    <YAxis stroke="#666" fontSize={9} domain={yDomain} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Line type="monotone" dataKey="amplitude" stroke={config.color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
            </div>
        );
    });

    // FFT chart component - Memoized to prevent unnecessary re-renders
    const FFTChart = React.memo(({
        data,
        color,
        expanded = false
    }: {
        data: FFTPoint[] | undefined;
        color: string;
        expanded?: boolean;
    }) => {
        // Memoize the data to prevent re-renders
        const chartData = useMemo(() => data || [], [data]);

        const height = expanded ? 350 : 80;
        const fontSize = expanded ? 11 : 8;

        if (!chartData || chartData.length === 0) {
            return (
                <div className={`h-[${height}px] flex items-center justify-center text-gray-500 text-xs`}>
                    Waiting for DSP PIC data...
                </div>
            );
        }

        if (expanded) {
            return (
                <div className="h-[400px] w-full overflow-auto">
                    <AreaChart width={900} height={500} data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="frequency" stroke="#666" fontSize={fontSize} tickFormatter={v => `${v}Hz`} />
                        <YAxis stroke="#666" fontSize={fontSize} domain={[0, 'auto']} />
                        <Area type="monotone" dataKey="magnitude" stroke={color} fill={color} fillOpacity={0.3} isAnimationActive={false} />
                    </AreaChart>
                </div>
            );
        }

        return (
            <div className="h-[80px] w-full">
                <AreaChart width={450} height={80} data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="frequency" stroke="#666" fontSize={8} tickFormatter={v => `${v}`} />
                    <YAxis stroke="#666" fontSize={8} domain={[0, 'auto']} />
                    <Area type="monotone" dataKey="magnitude" stroke={color} fill={color} fillOpacity={0.3} isAnimationActive={false} />
                </AreaChart>
            </div>
        );
    });

    // Sensor panel component - Memoized to reduce flickering
    const SensorPanel = React.memo(({
        sensor,
        data,
        voltage,
        fft,
        onExpandChart
    }: {
        sensor: 'A' | 'B';
        data: SensorData[];
        voltage: VoltageData;
        fft: { x: FFTPoint[]; y: FFTPoint[]; z: FFTPoint[] } | undefined;
        onExpandChart: (info: ExpandedChartInfo) => void;
    }) => {
        const config = sensorConfig[sensor];

        // Memoize the expand handler to prevent re-creation
        const handleExpandTime = useCallback((axis: 'x' | 'y' | 'z') => {
            onExpandChart({ sensor, axis, type: 'time' });
        }, [sensor, onExpandChart]);

        const handleExpandFFT = useCallback((axis: 'x' | 'y' | 'z') => {
            onExpandChart({ sensor, axis, type: 'fft' });
        }, [sensor, onExpandChart]);

        return (
            <div className={`space-y-3 p-3 rounded-xl border ${config.borderColor} bg-gradient-to-br from-gray-900/50 to-gray-800/30`}>
                {/* Sensor Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4" style={{ color: config.color }} />
                        <span className="font-semibold text-sm" style={{ color: config.color }}>{config.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">ADXL335</Badge>
                    </div>
                </div>

                {/* Voltage Indicators */}
                <Card className="bg-[#0d1321] border-gray-700/50">
                    <CardContent className="p-2">
                        <div className="text-[10px] text-gray-400 mb-1.5 flex items-center gap-1">
                            <Cpu className="w-3 h-3" /> Analog Output (0-3.3V)
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {(['x', 'y', 'z'] as const).map((axis) => (
                                <div key={axis} className="space-y-1">
                                    <div className="flex justify-between text-[10px]">
                                        <span style={{ color: axisConfig[axis].color }}>{axis.toUpperCase()}</span>
                                        <span className="text-gray-300 font-mono">{voltage[axis].toFixed(3)}V</span>
                                    </div>
                                    <VoltageBar voltage={voltage[axis]} color={axisConfig[axis].color} />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Time Domain Charts - Clickable for expanded view */}
                {(['x', 'y', 'z'] as const).map((axis) => (
                    <Card key={`${sensor}-time-${axis}`} className="bg-[#16213e] border-0">
                        <CardHeader className="py-1.5 px-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xs" style={{ color: axisConfig[axis].color }}>
                                    {axisConfig[axis].name} - Time Domain (Amplitude vs Time)
                                </CardTitle>
                                <button
                                    onClick={() => handleExpandTime(axis)}
                                    className="p-1.5 rounded hover:bg-cyan-500/20 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                    title="Click to expand"
                                >
                                    <Maximize2 className="w-4 h-4 text-cyan-400" />
                                </button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-1.5">
                            <TimeChart data={data} axis={axis} />
                        </CardContent>
                    </Card>
                ))}

                {/* FFT Charts - Clickable for expanded view */}
                <Card className="bg-[#1a1a2e] border-0">
                    <CardHeader className="py-1.5 px-3">
                        <div className="flex items-center gap-2">
                            <Cpu className="w-3 h-3 text-purple-400" />
                            <CardTitle className="text-xs text-purple-400">DSP PIC FFT Results (Frequency Domain)</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-2 space-y-2">
                        {(['x', 'y', 'z'] as const).map((axis) => (
                            <div key={`${sensor}-fft-${axis}`}>
                                <div className="flex items-center justify-between text-[10px] mb-1 p-1 rounded">
                                    <span style={{ color: axisConfig[axis].color }}>
                                        {axisConfig[axis].name} FFT
                                    </span>
                                    <button
                                        onClick={() => handleExpandFFT(axis)}
                                        className="p-1 rounded hover:bg-purple-500/20 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                        title="Click to expand"
                                    >
                                        <Maximize2 className="w-3.5 h-3.5 text-purple-400" />
                                    </button>
                                </div>
                                <FFTChart data={fft?.[axis]} color={axisConfig[axis].color} />
                            </div>
                        ))}
                        <div className="text-center text-[9px] text-gray-500">Frequency (Hz)</div>
                    </CardContent>
                </Card>
            </div>
        );
    });

    // Stable callback for expanding charts
    const handleExpandChart = useCallback((info: ExpandedChartInfo) => {
        setExpandedChart(info);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0d1321] via-[#1a1a2e] to-[#16213e] p-4">
            <div className="max-w-7xl mx-auto space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between bg-[#16213e]/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700/30">
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <Train className="w-6 h-6 text-blue-400" />
                            Train Vibration Detection System
                        </h1>
                        <p className="text-xs text-gray-400 mt-1">
                            {dataSource === 'esp32' ? 'ESP32 Live Data via HiveMQ MQTT' : 'ADXL335 Accelerometer × 2 | DSP PIC FFT Analysis | 500 Hz Sample Rate'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Data Source Toggle */}
                        <div className="flex rounded-lg overflow-hidden border border-gray-600">
                            <button
                                onClick={() => switchDataSource('simulation')}
                                className={`px-3 py-1.5 text-xs font-medium transition-colors ${dataSource === 'simulation'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                            >
                                Simulation
                            </button>
                            <button
                                onClick={() => switchDataSource('esp32')}
                                className={`px-3 py-1.5 text-xs font-medium transition-colors ${dataSource === 'esp32'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                            >
                                ESP32 Live
                            </button>
                        </div>

                        {/* ESP32 Status Badge */}
                        {dataSource === 'esp32' && (
                            <Badge
                                variant={esp32Status === 'online' ? 'default' : 'secondary'}
                                className={esp32Status === 'online' ? 'bg-emerald-600' : 'bg-orange-600'}
                            >
                                ESP32: {esp32Status}
                            </Badge>
                        )}

                        <Badge
                            variant={connectionStatus === 'connected' ? 'default' : 'secondary'}
                            className={connectionStatus === 'connected' ? 'bg-green-600' : ''}
                        >
                            {connectionStatus === 'connected' ? '● Live' : '○ Offline'}
                        </Badge>
                        {!isRunning ? (
                            <Button onClick={startSimulation} size="sm" className={dataSource === 'esp32'
                                ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                                : "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                            }>
                                <Play className="w-4 h-4 mr-1" /> {dataSource === 'esp32' ? 'Connect ESP32' : 'Start Simulation'}
                            </Button>
                        ) : (
                            <Button onClick={stopSimulation} variant="destructive" size="sm">
                                <Square className="w-4 h-4 mr-1" /> Stop
                            </Button>
                        )}
                    </div>
                </div>

                {/* Train Status Bar */}
                <div className="flex items-center justify-between bg-[#16213e]/60 backdrop-blur-sm rounded-lg p-3 border border-gray-700/20">
                    <div className="flex items-center gap-4">
                        <Train className="w-5 h-5 text-blue-400" />
                        <Badge className={`${getPhaseColor(trainState.phase)} text-white px-3`}>
                            {trainState.phase.toUpperCase()}
                        </Badge>
                        {trainState.direction && (
                            <span className="text-xs text-gray-400">
                                Direction: {trainState.direction === 'left-to-right' ? '→ East' : '← West'}
                            </span>
                        )}
                        {trainState.speed > 0 && (
                            <span className="text-sm text-white font-mono">{trainState.speed.toFixed(0)} km/h</span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={() => triggerTrain('left-to-right')}
                            disabled={!isRunning || trainState.phase !== 'idle'}
                            size="sm"
                            variant="outline"
                            className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20"
                        >
                            <ArrowRight className="w-4 h-4 mr-1" /> Train East
                        </Button>
                        <Button
                            onClick={() => triggerTrain('right-to-left')}
                            disabled={!isRunning || trainState.phase !== 'idle'}
                            size="sm"
                            variant="outline"
                            className="border-fuchsia-500/50 text-fuchsia-400 hover:bg-fuchsia-500/20"
                        >
                            Train West <ArrowLeft className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>

                {/* Sensor Panels - Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <SensorPanel
                        sensor="A"
                        data={sensorAData}
                        voltage={latestVoltageA}
                        fft={fftData?.sensorA}
                        onExpandChart={handleExpandChart}
                    />
                    <SensorPanel
                        sensor="B"
                        data={sensorBData}
                        voltage={latestVoltageB}
                        fft={fftData?.sensorB}
                        onExpandChart={handleExpandChart}
                    />
                </div>

                {/* Info Footer */}
                <div className="text-xs text-gray-500 text-center space-y-1 py-2">
                    <p>ADXL335: ±3g Range | 0-3.3V Analog Output | 330mV/g Sensitivity | 1.65V Zero-g</p>
                    <p>DSP PIC FFT: 256-point Window | 10-500 Hz Analysis Range</p>
                </div>
            </div>

            {/* Expanded Chart Modal */}
            <Dialog open={expandedChart !== null} onOpenChange={(open) => !open && setExpandedChart(null)}>
                <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] bg-[#0d1321] border-gray-700">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-white">
                            <Activity className="w-5 h-5" style={{ color: expandedChart ? sensorConfig[expandedChart.sensor].color : '#fff' }} />
                            <span style={{ color: expandedChart ? sensorConfig[expandedChart.sensor].color : '#fff' }}>
                                {expandedChart ? sensorConfig[expandedChart.sensor].name : ''} - {expandedChart ? axisConfig[expandedChart.axis].name : ''}
                            </span>
                            <Badge variant="outline" className="text-xs">
                                {expandedChart?.type === 'time' ? 'Time Domain' : 'FFT Frequency Domain'}
                            </Badge>
                        </DialogTitle>
                    </DialogHeader>

                    {expandedChart && (
                        <div className="space-y-4">
                            {/* Controls */}
                            <div className="flex items-center gap-6 p-3 bg-gray-800/50 rounded-lg">
                                {/* Zoom Control */}
                                <div className="flex items-center gap-2 flex-1">
                                    <ZoomOut className="w-4 h-4 text-gray-400" />
                                    <div className="flex-1">
                                        <div className="text-xs text-gray-400 mb-1">Zoom: {zoomLevel}x</div>
                                        <Slider
                                            value={[zoomLevel]}
                                            onValueChange={(v) => setZoomLevel(v[0])}
                                            min={1}
                                            max={5}
                                            step={0.5}
                                            className="w-full"
                                        />
                                    </div>
                                    <ZoomIn className="w-4 h-4 text-gray-400" />
                                </div>

                                {/* Y-Axis Scale Presets (only for time domain) */}
                                {expandedChart.type === 'time' && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">Y-Scale:</span>
                                        <div className="flex gap-1">
                                            {yAxisPresets.map((preset, idx) => (
                                                <Button
                                                    key={preset.label}
                                                    variant={yAxisPresetIndex === idx ? 'default' : 'outline'}
                                                    size="sm"
                                                    className={`text-xs px-2 py-1 h-7 ${yAxisPresetIndex === idx ? 'bg-cyan-600' : 'border-gray-600'}`}
                                                    onClick={() => setYAxisPresetIndex(idx)}
                                                >
                                                    {preset.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Expanded Chart */}
                            <div className="bg-[#16213e] rounded-lg p-4">
                                {expandedChart.type === 'time' ? (
                                    <TimeChart
                                        data={expandedChart.sensor === 'A'
                                            ? sensorAData.slice(-Math.floor(maxDataPoints / zoomLevel))
                                            : sensorBData.slice(-Math.floor(maxDataPoints / zoomLevel))}
                                        axis={expandedChart.axis}
                                        expanded={true}
                                        customYDomain={yAxisPresets[yAxisPresetIndex].value as [number, number] | null}
                                    />
                                ) : (
                                    <FFTChart
                                        data={expandedChart.sensor === 'A'
                                            ? fftData?.sensorA?.[expandedChart.axis]
                                            : fftData?.sensorB?.[expandedChart.axis]}
                                        color={axisConfig[expandedChart.axis].color}
                                        expanded={true}
                                    />
                                )}
                            </div>

                            {/* Help Text */}
                            <div className="text-xs text-gray-500 text-center">
                                {expandedChart.type === 'time'
                                    ? 'Use zoom to see more detail on the time axis. Use Y-Scale presets to view small amplitude signals.'
                                    : 'FFT shows the frequency components of the vibration signal. Higher magnitudes indicate dominant frequencies.'}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SensorSimulation;
