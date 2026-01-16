import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Train, ArrowRight, ArrowLeft, Cpu, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';

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

const API_URL = 'http://localhost:5000/api';

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
    const eventSourceRef = useRef<EventSource | null>(null);
    const fftIntervalRef = useRef<number | null>(null);
    const dataBufferRef = useRef<{ sensorA: SensorData[]; sensorB: SensorData[] }>({ sensorA: [], sensorB: [] });
    const animationFrameRef = useRef<number | null>(null);
    const lastUpdateRef = useRef<number>(0);
    const maxDataPoints = 256;
    const sampleRate = 50;
    const updateIntervalMs = 50; // Throttle to ~20 FPS for smooth charts
    const latestTrainStateRef = useRef<TrainState | null>(null);

    // Throttled update function to batch data updates
    const flushDataToState = useCallback(() => {
        const now = performance.now();
        if (now - lastUpdateRef.current >= updateIntervalMs) {
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
    const TimeChart = React.memo(({ data, axis }: { data: SensorData[]; axis: 'x' | 'y' | 'z' }) => {
        const config = axisConfig[axis];

        // Memoize the prepared time data
        const timeData = useMemo(() =>
            data.map((d, i) => ({ time: i * (1000 / sampleRate), amplitude: d[axis] })),
            [data, axis]
        );

        // Memoize domain to prevent axis flickering
        const yDomain = useMemo(() => [-20000, 70000] as [number, number], []);

        // Don't render chart if no data - prevents flash of empty chart
        if (data.length < 2) {
            return (
                <div className="h-[100px] flex items-center justify-center text-gray-500 text-xs">
                    Waiting for data...
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
    const FFTChart = React.memo(({ data, color }: { data: FFTPoint[] | undefined; color: string }) => {
        // Memoize the data to prevent re-renders
        const chartData = useMemo(() => data || [], [data]);

        if (!chartData || chartData.length === 0) {
            return (
                <div className="h-[80px] flex items-center justify-center text-gray-500 text-xs">
                    Waiting for DSP PIC data...
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

    // Sensor panel component
    const SensorPanel = ({
        sensor,
        data,
        voltage,
        fft
    }: {
        sensor: 'A' | 'B';
        data: SensorData[];
        voltage: VoltageData;
        fft: { x: FFTPoint[]; y: FFTPoint[]; z: FFTPoint[] } | undefined;
    }) => {
        const config = sensorConfig[sensor];
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

                {/* Time Domain Charts */}
                {(['x', 'y', 'z'] as const).map((axis) => (
                    <Card key={axis} className="bg-[#16213e] border-0">
                        <CardHeader className="py-1.5 px-3">
                            <CardTitle className="text-xs" style={{ color: axisConfig[axis].color }}>
                                {axisConfig[axis].name} - Time Domain (Amplitude vs Time)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-1.5">
                            <TimeChart data={data} axis={axis} />
                        </CardContent>
                    </Card>
                ))}

                {/* FFT Charts */}
                <Card className="bg-[#1a1a2e] border-0">
                    <CardHeader className="py-1.5 px-3">
                        <div className="flex items-center gap-2">
                            <Cpu className="w-3 h-3 text-purple-400" />
                            <CardTitle className="text-xs text-purple-400">DSP PIC FFT Results (Frequency Domain)</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-2 space-y-2">
                        {(['x', 'y', 'z'] as const).map((axis) => (
                            <div key={axis}>
                                <div className="text-[10px] mb-1" style={{ color: axisConfig[axis].color }}>
                                    {axisConfig[axis].name} FFT
                                </div>
                                <FFTChart data={fft?.[axis]} color={axisConfig[axis].color} />
                            </div>
                        ))}
                        <div className="text-center text-[9px] text-gray-500">Frequency (Hz)</div>
                    </CardContent>
                </Card>
            </div>
        );
    };

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
                    />
                    <SensorPanel
                        sensor="B"
                        data={sensorBData}
                        voltage={latestVoltageB}
                        fft={fftData?.sensorB}
                    />
                </div>

                {/* Info Footer */}
                <div className="text-xs text-gray-500 text-center space-y-1 py-2">
                    <p>ADXL335: ±3g Range | 0-3.3V Analog Output | 330mV/g Sensitivity | 1.65V Zero-g</p>
                    <p>DSP PIC FFT: 256-point Window | 10-500 Hz Analysis Range</p>
                </div>
            </div>
        </div>
    );
};

export default SensorSimulation;
