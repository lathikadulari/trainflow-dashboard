import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Train, ArrowRight, ArrowLeft, Cpu, Activity, ZoomIn, ZoomOut, Maximize, X as CloseIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area, ResponsiveContainer, Brush, Tooltip, ReferenceArea } from 'recharts';

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


// ═══════════════════════════════════════════════════════════════════
// MODULE-SCOPE COMPONENTS — stable identity prevents React remount
// ═══════════════════════════════════════════════════════════════════

const VoltageBar = React.memo(({ voltage, color }: { voltage: number; color: string }) => {
    const percentage = (voltage / 3.3) * 100;
    return (
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
                className="h-full transition-all duration-100"
                style={{ width: `${percentage}%`, backgroundColor: color }}
            />
        </div>
    );
});

const VISIBLE_WINDOW = 200; // Keep recent points bounded for rendering efficiency
const TIME_WINDOW_MS = 8000; // Fixed scrolling window for real-time moving charts
const TICK_STEP_MS = 100; // 0.1s tick grid
const LABEL_STEP_MS = 500; // Label every 0.5s for readability

const TimeChart = React.memo(({ data, axis, dataSource, sensor, onExpand }: {
    data: SensorData[]; axis: 'x' | 'y' | 'z'; dataSource: 'simulation' | 'esp32'; sensor: 'A' | 'B';
    onExpand: (info: { sensor: 'A' | 'B'; axis: 'x' | 'y' | 'z'; type: 'time' | 'fft'; data: any[] }) => void;
}) => {
    const config = axisConfig[axis];

    // Use raw incoming points (no resampling/compression) in a trailing realtime window.
    const chartData = useMemo(() => {
        const windowed = data.slice(-VISIBLE_WINDOW);
        if (windowed.length === 0) return [];
        const latestTs = windowed[windowed.length - 1].timestamp;
        const minTs = latestTs - TIME_WINDOW_MS;
        return windowed
            .filter((d) => d.timestamp >= minTs)
            .map((d) => ({
                time: d.timestamp - latestTs,
                amplitude: d[axis],
            }));
    }, [data, axis]);

    if (data.length < 2) {
        return (
            <div className="h-[100px] flex items-center justify-center text-gray-500 text-xs">
                Waiting for data...
            </div>
        );
    }

    const handleClick = () => {
        onExpand({ sensor, axis, type: 'time', data: chartData });
    };

    const ticks = [];
    for (let t = -TIME_WINDOW_MS; t <= 0; t += TICK_STEP_MS) {
        ticks.push(t);
    }

    return (
        <div className="w-full cursor-pointer" onClick={handleClick} title="Click to expand & zoom">
            <ResponsiveContainer width="100%" height={150}>
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={true} verticalCoordinatesGenerator={() => ticks} />
                    <XAxis 
                        dataKey="time" 
                        stroke="#666" 
                        fontSize={9} 
                        domain={[-TIME_WINDOW_MS, 0]} 
                        type="number" 
                        ticks={ticks}
                        tickFormatter={(v: number) => {
                            if (v !== 0 && Math.abs(v) % LABEL_STEP_MS !== 0) return '';
                            return v === 0 ? 'now' : `${Math.abs(v / 1000).toFixed(1)}s`;
                        }} 
                    />
                    <YAxis stroke="#666" fontSize={9} domain={[-3000, 3000]} tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}g`} />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #555', borderRadius: '8px', fontSize: '11px' }}
                        labelFormatter={(v: any) => `t-${Math.abs(Number(v) / 1000).toFixed(2)}s`}
                        formatter={(value: number) => [`${(value / 1000).toFixed(4)}g`, axis.toUpperCase()]}
                    />
                    <Line type="linear" dataKey="amplitude" stroke={config.color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
            </ResponsiveContainer>
            <div className="text-center text-[9px] text-gray-600 mt-0.5">
                🔍 Click to expand & zoom
            </div>
        </div>
    );
});

const FFTChart = React.memo(({ data, color, sensor, axis, onExpand }: {
    data: FFTPoint[] | undefined; color: string; sensor: 'A' | 'B'; axis: 'x' | 'y' | 'z';
    onExpand: (info: { sensor: 'A' | 'B'; axis: 'x' | 'y' | 'z'; type: 'time' | 'fft'; data: any[] }) => void;
}) => {
    const chartData = useMemo(() => data || [], [data]);

    if (!chartData || chartData.length === 0) {
        return (
            <div className="h-[80px] flex items-center justify-center text-gray-500 text-xs">
                Waiting for DSP PIC data...
            </div>
        );
    }

    const handleClick = () => {
        onExpand({
            sensor,
            axis,
            type: 'fft',
            data: [...chartData]
        });
    };

    return (
        <div className="w-full cursor-pointer" onClick={handleClick} title="Click to expand & zoom">
            <AreaChart width={450} height={80} data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="frequency" stroke="#666" fontSize={8} tickFormatter={(v: number) => `${v}`} />
                <YAxis stroke="#666" fontSize={8} domain={[0, 'auto']} />
                <Area type="monotone" dataKey="magnitude" stroke={color} fill={color} fillOpacity={0.3} isAnimationActive={false} animationDuration={0} />
            </AreaChart>
        </div>
    );
});

const SensorPanel = React.memo(({ sensor, data, voltage, fft, dataSource, onExpand }: {
    sensor: 'A' | 'B';
    data: SensorData[];
    voltage: VoltageData;
    fft: { x: FFTPoint[]; y: FFTPoint[]; z: FFTPoint[] } | undefined;
    dataSource: 'simulation' | 'esp32';
    onExpand: (info: { sensor: 'A' | 'B'; axis: 'x' | 'y' | 'z'; type: 'time' | 'fft'; data: any[] }) => void;
}) => {
    const config = sensorConfig[sensor];
    return (
        <div className={`space-y-3 p-3 rounded-xl border ${config.borderColor} bg-gradient-to-br from-gray-900/50 to-gray-800/30`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" style={{ color: config.color }} />
                    <span className="font-semibold text-sm" style={{ color: config.color }}>{config.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">ADXL335</Badge>
                </div>
                <span className="text-[10px] text-gray-500">Click any chart to zoom</span>
            </div>

            <Card className="bg-[#0d1321] border-gray-700/50">
                <CardContent className="p-2">
                    <div className="text-[10px] text-gray-400 mb-1.5 flex items-center gap-1">
                        <Cpu className="w-3 h-3" /> Analog Output (0-3.3V)
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {(['x', 'z'] as const).map((axis) => (
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

            {(['x', 'z'] as const).map((axis) => (
                <Card key={axis} className="bg-[#16213e] border-0">
                    <CardHeader className="py-1.5 px-3">
                        <CardTitle className="text-xs" style={{ color: axisConfig[axis].color }}>
                            {axisConfig[axis].name} - Time Domain (Amplitude vs Time)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-1.5">
                        <TimeChart data={data} axis={axis} dataSource={dataSource} sensor={sensor} onExpand={onExpand} />
                    </CardContent>
                </Card>
            ))}

            <Card className="bg-[#1a1a2e] border-0">
                <CardHeader className="py-1.5 px-3">
                    <div className="flex items-center gap-2">
                        <Cpu className="w-3 h-3 text-purple-400" />
                        <CardTitle className="text-xs text-purple-400">DSP PIC FFT Results (Frequency Domain)</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-2 space-y-2">
                    {(['x', 'z'] as const).map((axis) => (
                        <div key={axis}>
                            <div className="text-[10px] mb-1" style={{ color: axisConfig[axis].color }}>
                                {axisConfig[axis].name} FFT
                            </div>
                            <FFTChart data={fft?.[axis]} color={axisConfig[axis].color} sensor={sensor} axis={axis} onExpand={onExpand} />
                        </div>
                    ))}
                    <div className="text-center text-[9px] text-gray-500">Frequency (Hz)</div>
                </CardContent>
            </Card>
        </div>
    );
});

export interface SensorSimulationProps {
    isEmbedded?: boolean;
}

// Module Level: Expanded Zoom Modal with 2D Drag-to-Zoom
const ExpandedChartModal = React.memo(({ expandedChart, onClose, sensorAData, sensorBData, fftData }: any) => {
    const { sensor, axis, type } = expandedChart;
    const color = axisConfig[axis].color;
    const sConfig = sensorConfig[sensor];
    const yKey = type === 'time' ? 'amplitude' : 'magnitude';
    const xKey = type === 'time' ? 'time' : 'frequency';

    const MODAL_SAMPLE_RATE = 50;
    const MODAL_WINDOW = 400; // Show last ~8 seconds in expanded view at 50Hz

    const [modalPaused, setModalPaused] = useState(false);
    const pausedDataRef = useRef<any[] | null>(null);

    // Zoom State
    const [zoomDomainX, setZoomDomainX] = useState<[number, number] | null>(null);
    const [zoomDomainY, setZoomDomainY] = useState<[number, number] | null>(null);
    const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
    const [refAreaRight, setRefAreaRight] = useState<number | null>(null);

    // Manual Scale State (live and paused)
    const [zoomFactorX, setZoomFactorX] = useState<number>(1);
    const [zoomFactorY, setZoomFactorY] = useState<number>(1);

    // Get live data — raw, no processing
    const rawData = sensor === 'A' ? sensorAData : sensorBData;
    
    const liveChartData = useMemo(() => {
        if (type === 'time') {
            const windowed = rawData.slice(-MODAL_WINDOW);
            if (windowed.length === 0) return [];
            const t0 = windowed[0].timestamp;
            return windowed.map((d: any) => ({
                time: d.timestamp - t0,
                amplitude: d[axis]
            }));
        }
        return fftData ? (sensor === 'A' ? fftData.sensorA : fftData.sensorB)?.[axis] || [] : [];
    }, [rawData, fftData, type, sensor, axis]);

    const baseData = (modalPaused && pausedDataRef.current) ? pausedDataRef.current : liveChartData;

    // Apply manual X zoom (show fewer points from the end if time domain)
    const chartData = useMemo(() => {
        if (zoomFactorX <= 1) return baseData;
        const numPoints = Math.max(10, Math.floor(baseData.length / zoomFactorX));
        return baseData.slice(-numPoints);
    }, [baseData, zoomFactorX]);

    // Default Domains based on visible data
    const values = chartData.map((d: any) => d[yKey]);
    const minVal = values.length > 0 ? Math.min(...values) : -1000;
    const maxVal = values.length > 0 ? Math.max(...values) : 1000;
    const padding = Math.max(Math.abs(maxVal - minVal) * 0.15, 50);

    // Auto-calculating default Y Domain with Y-Zoom Factor applied
    const defaultYDomain = useMemo(() => {
        const center = (maxVal + minVal) / 2;
        const range = (maxVal - minVal + padding * 2) / zoomFactorY;
        return [center - range / 2, center + range / 2] as [number, number];
    }, [maxVal, minVal, padding, zoomFactorY]);

    // For time domain, X is min/max time. For FFT, X is 0 to max frequency.
    const defaultXDomain = chartData.length > 0 ? [chartData[0][xKey], chartData[chartData.length - 1][xKey]] as [number, number] : ['dataMin', 'dataMax'];

    const activeXDomain = zoomDomainX || defaultXDomain;
    const activeYDomain = zoomDomainY || defaultYDomain;

    const togglePause = () => {
        if (!modalPaused) {
            pausedDataRef.current = [...liveChartData];
            setModalPaused(true);
        } else {
            pausedDataRef.current = null;
            setModalPaused(false);
            zoomOut(); // Reset zoom when returning to live mode
        }
    };

    const zoomOut = () => {
        setZoomDomainX(null);
        setZoomDomainY(null);
        setRefAreaLeft(null);
        setRefAreaRight(null);
        setZoomFactorX(1);
        setZoomFactorY(1);
    };

    const onChartMouseDown = (e: any) => {
        if (!e || !modalPaused) return; // Only allow drag-to-zoom when paused!
        setRefAreaLeft(e.activeLabel);
    };

    const onChartMouseMove = (e: any) => {
        if (!e || refAreaLeft === null || !modalPaused) return;
        setRefAreaRight(e.activeLabel);
    };

    const onChartMouseUp = () => {
        if (!modalPaused || refAreaLeft === null || refAreaRight === null) {
            setRefAreaLeft(null);
            setRefAreaRight(null);
            return;
        }

        // Handle drawing backwards
        let [left, right] = [refAreaLeft, refAreaRight];
        if (left > right) [left, right] = [right, left];

        if (left === right || left === undefined || right === undefined) {
            zoomOut();
            return;
        }

        // Apply Zoom Domains
        setZoomDomainX([left, right]);

        // Let's filter data within domain to find the new Y boundaries
        const dataInZoom = chartData.filter((d: any) => d[xKey] >= left && d[xKey] <= right);
        const yValsInZoom = dataInZoom.map((d: any) => d[yKey]);

        if (yValsInZoom.length > 0) {
            const zMin = Math.min(...yValsInZoom);
            const zMax = Math.max(...yValsInZoom);
            const zPadding = Math.max(Math.abs(zMax - zMin) * 0.1, 10);
            setZoomDomainY([zMin - zPadding, zMax + zPadding]);
        }

        setRefAreaLeft(null);
        setRefAreaRight(null);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[#0d1321] border border-gray-700 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between p-4 border-b border-gray-700/50 bg-[#16213e] gap-4">
                    <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5" style={{ color: sConfig.color }} />
                        <span className="font-semibold" style={{ color: sConfig.color }}>{sConfig.name}</span>
                        <span className="text-sm text-gray-400">•</span>
                        <span className="font-medium" style={{ color }}>
                            {axisConfig[axis].name} — {type === 'time' ? 'Time Domain' : 'FFT'}
                        </span>
                        {modalPaused ? (
                            <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/40 text-xs text-nowrap">⏸ Paused & Ready</Badge>
                        ) : (
                            <Badge className="bg-green-600/20 text-green-400 border-green-600/40 text-xs animate-pulse text-nowrap">● Live</Badge>
                        )}
                    </div>

                    {/* Manual Zoom Toolbar */}
                    <div className="flex items-center gap-4 bg-[#0d1321] rounded-lg p-1 border border-gray-700/50">
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-xs text-gray-500 font-medium tracking-wide">Y-AXIS:</span>
                            <button onClick={() => setZoomFactorY(f => Math.max(0.5, f - 0.5))} className="p-1 hover:text-white text-gray-400 hover:bg-gray-800 rounded"><ZoomOut size={14} /></button>
                            <span className="text-xs text-gray-300 w-8 text-center bg-[#16213e] rounded py-0.5">{zoomFactorY}x</span>
                            <button onClick={() => setZoomFactorY(f => Math.min(10, f + 0.5))} className="p-1 hover:text-white text-gray-400 hover:bg-gray-800 rounded"><ZoomIn size={14} /></button>
                        </div>
                        <div className="w-px h-6 bg-gray-700/50"></div>
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-xs text-gray-500 font-medium tracking-wide">X-AXIS:</span>
                            <button onClick={() => setZoomFactorX(f => Math.max(1, f - 1))} className="p-1 hover:text-white text-gray-400 hover:bg-gray-800 rounded"><ZoomOut size={14} /></button>
                            <span className="text-xs text-gray-300 w-8 text-center bg-[#16213e] rounded py-0.5">{zoomFactorX}x</span>
                            <button onClick={() => setZoomFactorX(f => Math.min(10, f + 1))} className="p-1 hover:text-white text-gray-400 hover:bg-gray-800 rounded"><ZoomIn size={14} /></button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {(zoomDomainX || zoomDomainY || zoomFactorX > 1 || zoomFactorY > 1) && (
                            <Button onClick={zoomOut} size="sm" variant="outline" className="h-8 border-gray-600 hover:bg-gray-700 px-3 mr-2 text-xs">
                                <ZoomOut className="w-3.5 h-3.5 mr-1" /> Reset Zoom
                            </Button>
                        )}
                        <button
                            onClick={togglePause}
                            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all flex items-center gap-1.5 ${modalPaused
                                ? 'bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/40'
                                : 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-600/40'
                                }`}
                        >
                            {modalPaused ? (
                                <><Play className="w-3.5 h-3.5" /> Resume Live</>
                            ) : (
                                <><Square className="w-3.5 h-3.5" /> Pause to Drag Zoom</>
                            )}
                        </button>
                        <button onClick={onClose} className="p-2 ml-2 rounded-lg hover:bg-gray-700 transition-colors">
                            <CloseIcon className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Chart Area */}
                <div className="p-4 flex-1">
                    {chartData.length < 2 ? (
                        <div className="h-[420px] flex items-center justify-center text-gray-500">Waiting for data...</div>
                    ) : (
                        <div className="relative cursor-crosshair select-none h-[420px]">
                            {/* Zoom Instructions Overlay */}
                            {modalPaused && !zoomDomainX && (
                                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none animate-pulse">
                                    Click and drag across the chart to zoom X and Y axes
                                </div>
                            )}
                            <ResponsiveContainer width="100%" height="100%">
                                {type === 'time' ? (
                                    <LineChart
                                        data={chartData}
                                        onMouseDown={onChartMouseDown}
                                        onMouseMove={onChartMouseMove}
                                        onMouseUp={onChartMouseUp}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                        <XAxis
                                            dataKey={xKey} stroke="#888" fontSize={11}
                                            domain={activeXDomain} type="number" allowDataOverflow
                                            tickCount={11} // Try to push more ticks locally
                                            tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}s`}
                                        />
                                        <YAxis
                                            stroke="#888" fontSize={11}
                                            domain={activeYDomain} type="number" allowDataOverflow
                                            tickFormatter={(v: number) => `${(v / 1000).toFixed(3)}g`}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #555', borderRadius: '8px', fontSize: '12px' }}
                                            labelFormatter={(v: any) => `Time: ${(Number(v) / 1000).toFixed(3)}s`}
                                            formatter={(value: number) => [`${(value / 1000).toFixed(4)}g`, axis.toUpperCase()]}
                                        />
                                        <Line type="natural" dataKey={yKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />

                                        {refAreaLeft !== null && refAreaRight !== null && (
                                            <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill={color} fillOpacity={0.2} />
                                        )}
                                        {/* Brush is nice but conflicts with drag-to-zoom visually, disabled when paused in favor of drag zoom */}
                                        {!modalPaused && (
                                            <Brush dataKey={xKey} height={4} stroke="transparent" fill="transparent" travellerWidth={0} />
                                        )}
                                    </LineChart>
                                ) : (
                                    <AreaChart
                                        data={chartData}
                                        onMouseDown={onChartMouseDown}
                                        onMouseMove={onChartMouseMove}
                                        onMouseUp={onChartMouseUp}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                        <XAxis
                                            dataKey={xKey} stroke="#888" fontSize={11}
                                            domain={activeXDomain} type="number" allowDataOverflow
                                            tickFormatter={(v: number) => `${v} Hz`}
                                        />
                                        <YAxis
                                            stroke="#888" fontSize={11}
                                            domain={activeYDomain} type="number" allowDataOverflow
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #555', borderRadius: '8px', fontSize: '12px' }}
                                            labelFormatter={(v: any) => `${v} Hz`}
                                            formatter={(value: number) => [value.toFixed(4), 'Magnitude']}
                                        />
                                        <Area type="monotone" dataKey={yKey} stroke={color} fill={color} fillOpacity={0.3} strokeWidth={2} isAnimationActive={false} animationDuration={0} />

                                        {refAreaLeft !== null && refAreaRight !== null && (
                                            <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill={color} fillOpacity={0.2} />
                                        )}
                                    </AreaChart>
                                )}
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="px-4 pb-3 flex justify-between items-center text-[10px] text-gray-500 bg-[#0d1321]">
                    <span>{chartData.length} data points in view</span>
                    <span className="font-mono">
                        Y Range: {activeYDomain[0].toFixed(1)} to {activeYDomain[1].toFixed(1)}
                    </span>
                    <span>{modalPaused ? 'Drag across chart to zoom X/Y' : 'Pause to enable drag-zooming'}</span>
                </div>
            </div>
        </div>
    );
});

const SensorSimulation: React.FC<SensorSimulationProps> = ({ isEmbedded = false }) => {
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
    const latestTrainStateRef = useRef<TrainState | null>(null);
    const [filterNoise, setFilterNoise] = useState(true);

    // Expanded chart modal state
    const [expandedChart, setExpandedChart] = useState<{
        sensor: 'A' | 'B';
        axis: 'x' | 'y' | 'z';
        type: 'time' | 'fft';
    } | null>(null);

    const maxDataPoints = 600; // ~12 seconds at 50Hz display rate
    const sampleRate = 50;

    // Buffer flusher using requestAnimationFrame for smooth 60fps real-time scrolling
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (connectionStatus !== 'connected') return;

        const tick = () => {
            const newA = dataBufferRef.current.sensorA;
            const newB = dataBufferRef.current.sensorB;

            if (newA.length > 0 || newB.length > 0) {
                // Swap the buffer atomically
                dataBufferRef.current = { sensorA: [], sensorB: [] };

                setSensorAData(prev => {
                    const merged = prev.concat(newA);
                    return merged.length > maxDataPoints ? merged.slice(-maxDataPoints) : merged;
                });
                setSensorBData(prev => {
                    const merged = prev.concat(newB);
                    return merged.length > maxDataPoints ? merged.slice(-maxDataPoints) : merged;
                });
            }

            if (latestTrainStateRef.current) {
                setTrainState(latestTrainStateRef.current);
                latestTrainStateRef.current = null;
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [connectionStatus, maxDataPoints]);

    // Connect to local simulation stream
    const connectToStream = useCallback(() => {
        if (eventSourceRef.current) eventSourceRef.current.close();
        const eventSource = new EventSource(`${API_URL}/simulation/stream`);
        eventSourceRef.current = eventSource;
        eventSource.onopen = () => setConnectionStatus('connected');
        eventSource.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'data') {
                const { batch } = message.data;
                if (batch && Array.isArray(batch)) {
                    // Handle batched data - each batch contains 10 samples for dense waveforms
                    for (const sample of batch) {
                        dataBufferRef.current.sensorA.push(sample.sensorA);
                        dataBufferRef.current.sensorB.push(sample.sensorB);
                        if (sample.trainState) {
                            latestTrainStateRef.current = sample.trainState;
                        }
                    }
                } else {
                    // Fallback for single-sample format
                    const { sensorA, sensorB, trainState: state } = message.data;
                    dataBufferRef.current.sensorA.push(sensorA);
                    dataBufferRef.current.sensorB.push(sensorB);
                    if (state) latestTrainStateRef.current = state;
                }
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
            // Use real ESP32 data from MQTT string
            setIsRunning(true);
            connectToESP32Stream();
            // Poll FFT from MQTT buffer more frequently for instant updates
            fftIntervalRef.current = window.setInterval(fetchMqttFFT, 100);
        } else {
            // Use local simulation
            await fetch(`${API_URL}/simulation/start`, { method: 'POST' });
            setIsRunning(true);
            connectToStream();
            fftIntervalRef.current = window.setInterval(fetchFFT, 100);
        }
    };

    const stopSimulation = async () => {
        if (dataSource === 'simulation') {
            await fetch(`${API_URL}/simulation/stop`, { method: 'POST' });
        }
        setIsRunning(false);
        eventSourceRef.current?.close();
        if (fftIntervalRef.current) clearInterval(fftIntervalRef.current);
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

    // Stable callback for chart expansion
    const handleExpand = useCallback((info: { sensor: 'A' | 'B'; axis: 'x' | 'y' | 'z'; type: 'time' | 'fft'; data: any[] }) => {
        setExpandedChart({ sensor: info.sensor, axis: info.axis, type: info.type });
    }, []);
    return (
        <div className={isEmbedded ? "w-full" : "min-h-screen bg-gradient-to-br from-[#0d1321] via-[#1a1a2e] to-[#16213e] p-4"}>
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
                        dataSource={dataSource}
                        onExpand={handleExpand}
                    />
                    <SensorPanel
                        sensor="B"
                        data={sensorBData}
                        voltage={latestVoltageB}
                        fft={fftData?.sensorB}
                        dataSource={dataSource}
                        onExpand={handleExpand}
                    />
                </div>

                {/* Expanded Chart Modal */}
                {expandedChart && (
                    <ExpandedChartModal
                        expandedChart={expandedChart}
                        onClose={() => setExpandedChart(null)}
                        sensorAData={sensorAData}
                        sensorBData={sensorBData}
                        fftData={fftData}
                    />
                )}

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
