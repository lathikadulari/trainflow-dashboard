import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Cpu, 
  Activity, 
  Radio, 
  ArrowRight, 
  CheckCircle2, 
  TrendingUp, 
  Zap, 
  Layers, 
  BrainCircuit, 
  Gauge, 
  Compass, 
  Train,
  Server,
  Cloud,
  Smartphone,
  Eye,
  Sliders,
  Sparkles,
  Info,
  Database
} from 'lucide-react';
import { toast } from 'sonner';

export default function ResearchMethodology() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [direction, setDirection] = useState<'L2R' | 'R2L'>('R2L');
  const [activeStep, setActiveStep] = useState<number>(0);
  const [trainPosition, setTrainPosition] = useState<number>(0); // 0 to 100%
  const [calculatedSpeed, setCalculatedSpeed] = useState<number>(16.3);
  const [deltaMs, setDeltaMs] = useState<number>(142);
  const [confidence, setConfidence] = useState<number>(96.4);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-advance train position & pipeline stages when playing
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setTrainPosition((prev) => {
        const next = prev + 0.5;
        if (next > 100) {
          return 0;
        }
        return next;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Update pipeline step based on train position (8 stages)
  useEffect(() => {
    if (trainPosition < 12.5) setActiveStep(0); // 1. Sensors
    else if (trainPosition < 25) setActiveStep(1); // 2. ADC Converter
    else if (trainPosition < 37.5) setActiveStep(2); // 3. dsPIC FFT
    else if (trainPosition < 50) setActiveStep(3); // 4. AI Model
    else if (trainPosition < 62.5) setActiveStep(4); // 5. 4G LTE Module
    else if (trainPosition < 75) setActiveStep(5); // 6. AWS MQTT
    else if (trainPosition < 87.5) setActiveStep(6); // 7. Database
    else setActiveStep(7); // 8. Dashboard
  }, [trainPosition]);

  // Dynamic Signal Waveform Canvas Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const render = () => {
      time += 0.05;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Draw Sensor A Signal (Cyan)
      ctx.beginPath();
      ctx.strokeStyle = '#06b6d4'; // cyan-500
      ctx.lineWidth = 2;

      const isNearSensorA = Math.abs(trainPosition - 30) < 25;
      const ampA = isNearSensorA ? 35 * Math.exp(-Math.pow(trainPosition - 30, 2) / 80) : 4;

      for (let x = 0; x < width; x++) {
        const freq1 = Math.sin(x * 0.04 + time * 3);
        const freq2 = Math.sin(x * 0.1 - time * 2) * 0.5;
        const noise = (Math.random() - 0.5) * 2;
        const y = centerY - 25 + (freq1 + freq2) * ampA + noise;

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Draw Sensor B Signal (Emerald) - delayed according to train direction
      ctx.beginPath();
      ctx.strokeStyle = '#10b981'; // emerald-500
      ctx.lineWidth = 2;

      const sensorBPos = direction === 'L2R' ? 42 : 18;
      const isNearSensorB = Math.abs(trainPosition - sensorBPos) < 25;
      const ampB = isNearSensorB ? 35 * Math.exp(-Math.pow(trainPosition - sensorBPos, 2) / 80) : 4;

      for (let x = 0; x < width; x++) {
        const freq1 = Math.sin((x - 15) * 0.04 + time * 3);
        const freq2 = Math.sin((x - 15) * 0.1 - time * 2) * 0.5;
        const noise = (Math.random() - 0.5) * 2;
        const y = centerY + 25 + (freq1 + freq2) * ampB + noise;

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [trainPosition, direction]);

  const pipelineSteps = [
    {
      id: 0,
      name: "1. Vibration Sensors",
      icon: Activity,
      color: "from-cyan-500 to-blue-500",
      badgeColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
      subtitle: "ADXL335 Accelerometers (Sensors A & B)",
      description: "Dual tri-axial vibration sensors installed along railway track sleepers capture ground vibration waveforms as train wheels hit the rails.",
      technical: [
        "Transducer: ADXL335 MEMS Accelerometers",
        "Placement: Dual track sleepers (10m baseline)",
        "Outputs: Analog voltage signals g(t)"
      ]
    },
    {
      id: 1,
      name: "2. ADC Converter",
      icon: Cpu,
      color: "from-blue-500 to-indigo-500",
      badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      subtitle: "High-Speed Sampling & Digitization",
      description: "Continuous analog vibration signals are sampled into high-resolution digital time series data streams by the ADC converter.",
      technical: [
        "Sampling Rate: 1000 Hz (1ksps continuous)",
        "Resolution: 12-bit ADC digitization",
        "Signal Normalization: DC offset removal"
      ]
    },
    {
      id: 2,
      name: "3. dsPIC FFT",
      icon: Sliders,
      color: "from-indigo-500 to-purple-500",
      badgeColor: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
      subtitle: "DSP Bandpass Filtering & Fast Fourier Transform",
      description: "dsPIC microcontroller processes digital signals, filtering environmental noise and converting Time Domain g(t) to Frequency Domain g(f).",
      technical: [
        "Processor: dsPIC Digital Signal Controller",
        "Filtering: 5 Hz – 150 Hz structural passband",
        "FFT Window: 512-point Fast Fourier Transform"
      ]
    },
    {
      id: 3,
      name: "4. AI Model",
      icon: BrainCircuit,
      color: "from-purple-500 to-pink-500",
      badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      subtitle: "Edge AI Train Approach Detection",
      description: "On-edge AI Neural Network model evaluates processed vibration frequency spectra to detect and classify incoming train approach events.",
      technical: [
        "Primary Function: Train Approach Detection",
        "Model Type: Edge Neural Network (TinyML)",
        "Classification: Approach Warning vs Background Noise"
      ]
    },
    {
      id: 4,
      name: "5. 4G LTE Module",
      icon: Radio,
      color: "from-pink-500 to-rose-500",
      badgeColor: "bg-pink-500/20 text-pink-400 border-pink-500/30",
      subtitle: "Cellular Telemetry Gateway",
      description: "4G LTE cellular module packages AI inference results into lightweight payload packets for immediate wireless cloud transmission.",
      technical: [
        "Hardware: 4G LTE IoT Gateway Module",
        "Packetization: JSON Telemetry Payloads",
        "Latency: <200 ms cellular link delay"
      ]
    },
    {
      id: 5,
      name: "6. AWS MQTT",
      icon: Cloud,
      color: "from-rose-500 to-amber-500",
      badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      subtitle: "AWS IoT Core Cloud MQTT Broker",
      description: "AWS IoT Core receives encrypted MQTT payloads from trackside gateways and distributes messages to cloud ingestion microservices.",
      technical: [
        "Broker: AWS IoT Core MQTT Service",
        "Security: TLS 1.3 mutual authentication",
        "QoS Level: QoS 1 guaranteed delivery"
      ]
    },
    {
      id: 6,
      name: "7. Database",
      icon: Server,
      color: "from-amber-500 to-emerald-500",
      badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      subtitle: "Cloud Time-Series & Telemetry Storage",
      description: "Ingested MQTT payloads are stored in the cloud Database for real-time querying, historical analytics, and station logs.",
      technical: [
        "Storage Engine: PostgreSQL / TimeScaleDB",
        "Indexing: Station & Timestamp spatial indexes",
        "Persistence: Instant event log archival"
      ]
    },
    {
      id: 7,
      name: "8. Dashboard",
      icon: Smartphone,
      color: "from-emerald-500 to-teal-400",
      badgeColor: "bg-teal-500/20 text-teal-400 border-teal-500/30",
      subtitle: "Live TrainTrack Monitoring Dashboard",
      description: "Real-time train approach status, speed, direction, and safety alerts rendered dynamically on the TrainTrack Dashboard UI.",
      technical: [
        "UI Framework: React & WebSockets / SSE",
        "Update Rate: Real-time dynamic updates",
        "Alert System: Visual & Audio warning banners"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary selection:text-primary-foreground">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Page Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 flex items-center gap-1">
                <BrainCircuit className="w-3.5 h-3.5" /> Research Methodology Pipeline
              </Badge>
              <Badge variant="outline" className="bg-success/10 text-success border-success/30 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> Published in JRTE Journal
              </Badge>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-amber-400 animate-pulse" /> Dual-Sensor Vibration Research Architecture
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Interactive end-to-end telemetry simulation: <strong>Sensors ➔ ADC Converter ➔ dsPIC FFT ➔ AI Model ➔ 4G LTE Module ➔ AWS MQTT ➔ Database ➔ Dashboard</strong>.
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 bg-card/60 p-2 rounded-xl border border-border/50 shadow-md">
            <Button
              size="sm"
              variant={isPlaying ? "outline" : "default"}
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-2 font-medium"
            >
              {isPlaying ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 fill-current text-emerald-400" />}
              {isPlaying ? "Pause Simulation" : "Play Simulation"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setTrainPosition(0);
                toast.info("Simulation reset to start");
              }}
              className="flex items-center gap-1.5 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </Button>

            <div className="h-6 w-[1px] bg-border/60" />

            <Button
              size="sm"
              variant={direction === 'L2R' ? "secondary" : "ghost"}
              onClick={() => {
                setDirection(direction === 'L2R' ? 'R2L' : 'L2R');
                toast.info(`Train Direction set to: ${direction === 'L2R' ? 'Right to Left' : 'Left to Right'}`);
              }}
              className="text-xs font-mono flex items-center gap-1.5"
            >
              <Train className="w-3.5 h-3.5 text-primary" />
              Direction: <span className="text-primary font-bold">{direction === 'L2R' ? 'Left ➔ Right' : 'Right ➔ Left'}</span>
            </Button>
          </div>
        </div>

        {/* Dynamic Animated Railway & Sensor Setup Visualizer */}
        <Card className="bg-card/80 border-border/60 shadow-xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-amber-500/5 pointer-events-none" />

          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Train className="w-5 h-5 text-primary" /> Live Track & Vibration Sensor Simulation Setup
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time visualization of train approach across ADXL335 Sensor A and Sensor B with propagation delay Δt.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono text-xs bg-slate-950 text-cyan-400 border-cyan-500/40">
                  Calculated Δt: {deltaMs} ms
                </Badge>
                <Badge variant="outline" className="font-mono text-xs bg-slate-950 text-emerald-400 border-emerald-500/40">
                  Estimated Speed: {calculatedSpeed} km/h
                </Badge>
                <Badge variant="outline" className="font-mono text-xs bg-slate-950 text-amber-400 border-amber-500/40">
                  Confidence: {confidence}%
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Animated High-Visibility Railway Track Container */}
            <div className="relative h-48 bg-stone-950 rounded-2xl border-2 border-stone-800 overflow-hidden flex flex-col justify-center px-8 shadow-[inset_0_0_30px_rgba(0,0,0,0.9)]">
              {/* Ballast Gravel Bed Texture */}
              <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:12px_12px] opacity-40 pointer-events-none" />

              {/* Wooden Railway Sleeper Cross-Ties (High Contrast & Visible) */}
              <div className="absolute inset-x-0 h-16 top-1/2 -translate-y-1/2 flex justify-between px-3 pointer-events-none z-0">
                {Array.from({ length: 36 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="w-2.5 h-full bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950 rounded-xs border-x border-amber-950 shadow-[0_2px_4px_rgba(0,0,0,0.8)] relative"
                  >
                    {/* Metal Rail Fastener Clips on Sleepers */}
                    <div className="absolute top-1 inset-x-0 h-1 bg-amber-600/80 rounded-full" />
                    <div className="absolute bottom-1 inset-x-0 h-1 bg-amber-600/80 rounded-full" />
                  </div>
                ))}
              </div>

              {/* High-Shine Metallic Steel Rails */}
              <div className="relative w-full h-14 flex flex-col justify-between z-10">
                <div className="w-full h-2.5 bg-gradient-to-r from-slate-400 via-slate-100 to-slate-400 shadow-[0_0_10px_rgba(255,255,255,0.3)] border-y border-slate-300 rounded-full" />
                <div className="w-full h-2.5 bg-gradient-to-r from-slate-400 via-slate-100 to-slate-400 shadow-[0_0_10px_rgba(255,255,255,0.3)] border-y border-slate-300 rounded-full" />

                {/* ADXL335 Sensor A Pin */}
                <div className="absolute left-[30%] top-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-10">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)] animate-pulse">
                    <Activity className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="mt-1 bg-slate-900/90 text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-500/40 text-cyan-300">
                    ADXL335 Sensor A
                  </div>
                </div>

                {/* ADXL335 Sensor B Pin */}
                <div className="absolute left-[70%] top-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-10">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse">
                    <Activity className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-1 bg-slate-900/90 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-300">
                    ADXL335 Sensor B
                  </div>
                </div>

                {/* Distance Measurement Line */}
                <div className="absolute left-[30%] right-[30%] top-1/2 -translate-y-1/2 h-[1px] bg-dashed border-t border-dashed border-slate-500/60 flex items-center justify-center">
                  <span className="bg-slate-900 text-[10px] font-mono px-2 py-0.5 text-slate-400 rounded border border-slate-700">
                    Baseline Distance (10 meters)
                  </span>
                </div>

                {/* Authentic Sri Lanka Railways Brown & Black Train Container */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 transition-all duration-75 flex items-center z-20"
                  style={{
                    left: `${direction === 'L2R' ? trainPosition : 100 - trainPosition}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  {/* Light Brown & Dark Accent Sri Lanka Railways Train Body */}
                  <div className="w-[460px] h-12 bg-gradient-to-r from-[#5c2b0e] via-[#78350f] to-[#431e0a] rounded-xl border-2 border-[#b45309] shadow-[0_0_15px_rgba(180,83,9,0.4)] flex items-center justify-between px-4 text-amber-50 relative overflow-hidden">
                    {/* Top Light Brown Accent Stripe & Bottom Dark Trim */}
                    <div className="absolute inset-x-0 top-0.5 h-1.5 bg-gradient-to-r from-[#d97706] via-[#b45309] to-[#d97706]" />
                    <div className="absolute inset-x-0 bottom-0.5 h-1 bg-[#2b140a]" />

                    {/* Front Engine Section (Left for L2R, Right for R2L) */}
                    {direction === 'L2R' ? (
                      <>
                        {/* Front Engine Speed Badge */}
                        <div className="flex items-center gap-2 z-10 pl-1 mt-1">
                          <div className="p-1 rounded-md bg-[#2b140a]/80 border border-[#b45309]">
                            <Train className="w-5 h-5 text-amber-300" />
                          </div>
                          <div className="text-[11px] font-mono text-amber-200 font-extrabold flex items-center gap-1">
                            <Gauge className="w-3 h-3 text-amber-300" /> {calculatedSpeed} km/h
                          </div>
                        </div>

                        {/* Middle Light Brown Body Stripes */}
                        <div className="flex items-center gap-2 z-10 opacity-60 mt-1">
                          <div className="w-12 h-1 bg-amber-300 rounded-full" />
                          <div className="w-12 h-1 bg-amber-300 rounded-full" />
                          <div className="w-12 h-1 bg-amber-300 rounded-full" />
                        </div>

                        {/* Rear Tail Indicator */}
                        <div className="w-2.5 h-4 rounded-l-full bg-[#78350f] border border-amber-500 z-10 mt-1" />

                        {/* Right Headlight Beam */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-6 rounded-r-full bg-amber-300 shadow-[0_0_8px_#fde047]" />
                      </>
                    ) : (
                      <>
                        {/* Left Headlight Beam for R2L */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-6 rounded-l-full bg-amber-300 shadow-[0_0_8px_#fde047]" />

                        {/* Rear Tail (Right side for R2L) */}
                        <div className="w-2.5 h-4 rounded-r-full bg-[#78350f] border border-amber-500 z-10 mt-1" />

                        {/* Middle Light Brown Body Stripes */}
                        <div className="flex items-center gap-2 z-10 opacity-60 mt-1">
                          <div className="w-12 h-1 bg-amber-300 rounded-full" />
                          <div className="w-12 h-1 bg-amber-300 rounded-full" />
                          <div className="w-12 h-1 bg-amber-300 rounded-full" />
                        </div>

                        {/* Front Engine Speed Badge (Left for R2L) */}
                        <div className="flex items-center gap-2 z-10 pr-1 mt-1">
                          <div className="text-[11px] font-mono text-amber-200 font-extrabold flex items-center gap-1">
                            <Gauge className="w-3 h-3 text-amber-300" /> {calculatedSpeed} km/h
                          </div>
                          <div className="p-1 rounded-md bg-[#2b140a]/80 border border-[#b45309]">
                            <Train className="w-5 h-5 text-amber-300" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Dual Waveform Canvas */}
            <div className="bg-slate-950 rounded-xl p-4 border border-border/50 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-2 text-cyan-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" /> Sensor A Time-Domain Output g(t)
                </span>
                <span className="flex items-center gap-2 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Sensor B Time-Domain Output g(t)
                </span>
              </div>
              <canvas ref={canvasRef} width={800} height={100} className="w-full h-24 rounded bg-black/40 border border-white/5" />
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Animated Data Flow Diagram: Sensors ➔ Dashboard */}
        <Card className="bg-card/90 border-border/60 shadow-xl overflow-hidden">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 mb-1 flex items-center gap-1 w-fit">
                  <Radio className="w-3 h-3 animate-pulse" /> Real-Time Telemetry Route
                </Badge>
                <CardTitle className="text-xl font-extrabold flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-primary" /> End-to-End Data Flow Architecture
                </CardTitle>
                <CardDescription className="text-xs">
                  Telemetry route: <strong className="text-cyan-400 font-mono">Sensors ➔ ADC Converter ➔ dsPIC FFT ➔ AI Model ➔ 4G LTE Module ➔ AWS MQTT ➔ Database ➔ Dashboard</strong>
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-border/50 text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Live Data Packet Transit: <strong className="text-white">Active</strong></span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Animated Data Flow Nodes Diagram */}
            <div className="relative bg-slate-950 p-5 rounded-2xl border border-border/60 overflow-hidden shadow-inner space-y-4">
              
              {/* Row 1: Steps 1 to 4 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center relative z-10">
                
                {/* Node 1: Sensors */}
                <div className={`p-3 rounded-xl transition-all duration-300 flex flex-col items-center text-center space-y-1.5 shadow-md relative group ${
                  activeStep === 0 
                    ? 'bg-cyan-950/80 border-2 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)] scale-[1.03]' 
                    : 'bg-cyan-950/30 border border-cyan-500/30 hover:border-cyan-400/60'
                }`}>
                  <div className="p-2.5 rounded-lg bg-cyan-500/20 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]">
                    <Activity className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-extrabold text-foreground">1. Sensors</span>
                  <span className="text-[9px] font-mono text-cyan-400/90 font-semibold">ADXL335 Analog g(t)</span>
                  {activeStep === 0 && (
                    <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-ping hidden md:block" />
                  )}
                </div>

                {/* Node 2: ADC Converter */}
                <div className={`p-3 rounded-xl transition-all duration-300 flex flex-col items-center text-center space-y-1.5 shadow-md relative group ${
                  activeStep === 1 
                    ? 'bg-blue-950/80 border-2 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.4)] scale-[1.03]' 
                    : 'bg-blue-950/30 border border-blue-500/30 hover:border-blue-400/60'
                }`}>
                  <div className="p-2.5 rounded-lg bg-blue-500/20 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.4)]">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-extrabold text-foreground">2. ADC Converter</span>
                  <span className="text-[9px] font-mono text-blue-400/90 font-semibold">1000 Hz Sampling</span>
                  {activeStep === 1 && (
                    <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_8px_#3b82f6] animate-ping hidden md:block" />
                  )}
                </div>

                {/* Node 3: dsPIC FFT */}
                <div className={`p-3 rounded-xl transition-all duration-300 flex flex-col items-center text-center space-y-1.5 shadow-md relative group ${
                  activeStep === 2 
                    ? 'bg-indigo-950/80 border-2 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)] scale-[1.03]' 
                    : 'bg-indigo-950/30 border border-indigo-500/30 hover:border-indigo-400/60'
                }`}>
                  <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.4)]">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-extrabold text-foreground">3. dsPIC FFT</span>
                  <span className="text-[9px] font-mono text-indigo-400/90 font-semibold">Time ➔ Freq g(f)</span>
                  {activeStep === 2 && (
                    <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_8px_#6366f1] animate-ping hidden md:block" />
                  )}
                </div>

                {/* Node 4: AI Model */}
                <div className={`p-3 rounded-xl transition-all duration-300 flex flex-col items-center text-center space-y-1.5 shadow-md relative group ${
                  activeStep === 3 
                    ? 'bg-purple-950/80 border-2 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-[1.03]' 
                    : 'bg-purple-950/30 border border-purple-500/30 hover:border-purple-400/60'
                }`}>
                  <div className="p-2.5 rounded-lg bg-purple-500/20 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.4)]">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-extrabold text-foreground">4. AI Model</span>
                  <span className="text-[9px] font-mono text-purple-400/90 font-semibold">Approach Detection</span>
                </div>

              </div>

              {/* Connecting Row Arrow Indicator */}
              <div className="flex items-center justify-between px-4 text-xs font-mono text-muted-foreground border-y border-border/30 py-1.5 my-1">
                <span className="text-[10px] text-cyan-400/80">Stage 1-4: Trackside Edge Sensing & AI Approach Detection</span>
                <span className="flex items-center gap-1.5 text-pink-400 font-bold">
                  Wireless Cellular Route <ArrowRight className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                </span>
                <span className="text-[10px] text-emerald-400/80">Stage 5-8: Cloud Telemetry & Live Dashboard Warning</span>
              </div>

              {/* Row 2: Steps 5 to 8 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center relative z-10">
                
                {/* Node 5: 4G LTE Module */}
                <div className={`p-3 rounded-xl transition-all duration-300 flex flex-col items-center text-center space-y-1.5 shadow-md relative group ${
                  activeStep === 4 
                    ? 'bg-pink-950/80 border-2 border-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.4)] scale-[1.03]' 
                    : 'bg-pink-950/30 border border-pink-500/30 hover:border-pink-400/60'
                }`}>
                  <div className="p-2.5 rounded-lg bg-pink-500/20 text-pink-400 shadow-[0_0_12px_rgba(236,72,153,0.4)]">
                    <Radio className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-extrabold text-foreground">5. 4G LTE Module</span>
                  <span className="text-[9px] font-mono text-pink-400/90 font-semibold">Cellular Telemetry Gateway</span>
                  {activeStep === 4 && (
                    <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-pink-400 shadow-[0_0_8px_#ec4899] animate-ping hidden md:block" />
                  )}
                </div>

                {/* Node 6: AWS MQTT */}
                <div className={`p-3 rounded-xl transition-all duration-300 flex flex-col items-center text-center space-y-1.5 shadow-md relative group ${
                  activeStep === 5 
                    ? 'bg-amber-950/80 border-2 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] scale-[1.03]' 
                    : 'bg-amber-950/30 border border-amber-500/30 hover:border-amber-400/60'
                }`}>
                  <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-extrabold text-foreground">6. AWS MQTT</span>
                  <span className="text-[9px] font-mono text-amber-400/90 font-semibold">AWS IoT Core Broker</span>
                  {activeStep === 5 && (
                    <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-ping hidden md:block" />
                  )}
                </div>

                {/* Node 7: Database */}
                <div className={`p-3 rounded-xl transition-all duration-300 flex flex-col items-center text-center space-y-1.5 shadow-md relative group ${
                  activeStep === 6 
                    ? 'bg-emerald-950/80 border-2 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-[1.03]' 
                    : 'bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-400/60'
                }`}>
                  <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]">
                    <Database className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-extrabold text-foreground">7. Database</span>
                  <span className="text-[9px] font-mono text-emerald-400/90 font-semibold">Time-Series Telemetry DB</span>
                  {activeStep === 6 && (
                    <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-ping hidden md:block" />
                  )}
                </div>

                {/* Node 8: Dashboard */}
                <div className={`p-3 rounded-xl transition-all duration-300 flex flex-col items-center text-center space-y-1.5 shadow-md relative group ${
                  activeStep === 7 
                    ? 'bg-teal-950/90 border-2 border-teal-400 shadow-[0_0_25px_rgba(20,184,166,0.6)] scale-[1.04]' 
                    : 'bg-teal-950/40 border border-teal-500/40 hover:border-teal-400/60'
                }`}>
                  <div className="p-2.5 rounded-lg bg-teal-500/20 text-teal-400 shadow-[0_0_12px_rgba(20,184,166,0.6)] animate-pulse">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-extrabold text-teal-300">8. Dashboard</span>
                  <span className="text-[9px] font-mono text-teal-400/90 font-bold">Live Warning Rendered</span>
                </div>

              </div>
            </div>

            {/* Live Rendered Dashboard Train Approach Card Preview */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" /> Live Resulting Dashboard Approach Card Render
              </h3>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/40 border-2 border-emerald-500/50 shadow-2xl space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border/40 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                      <Train className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-extrabold text-foreground">Makumbura Station</span>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-mono text-[10px]">
                          STATUS: APPROACHING
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Train ID: <span className="text-foreground font-mono font-bold">EX-104 (Podi Menike)</span></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-muted-foreground font-semibold">Current Speed</div>
                      <div className="text-xl font-extrabold text-emerald-400 font-mono">{calculatedSpeed} km/h</div>
                    </div>
                    <div className="h-8 w-[1px] bg-border/60" />
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-muted-foreground font-semibold">Direction</div>
                      <div className="text-sm font-bold text-foreground font-mono">{direction === 'L2R' ? 'Left ➔ Right' : 'Right ➔ Left'}</div>
                    </div>
                  </div>
                </div>

                {/* Real-time Telemetry Metrics Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-background/60 border border-border/40 space-y-0.5">
                    <span className="text-[10px] text-muted-foreground block">Propagation Delay (Δt)</span>
                    <span className="font-mono font-bold text-cyan-400">{deltaMs} ms</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background/60 border border-border/40 space-y-0.5">
                    <span className="text-[10px] text-muted-foreground block">Baseline Distance</span>
                    <span className="font-mono font-bold text-foreground">10.0 meters</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background/60 border border-border/40 space-y-0.5">
                    <span className="text-[10px] text-muted-foreground block">Model Confidence</span>
                    <span className="font-mono font-bold text-amber-400">{confidence}%</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background/60 border border-border/40 space-y-0.5">
                    <span className="text-[10px] text-muted-foreground block">Early Warning Trigger</span>
                    <span className="font-mono font-bold text-emerald-400">ACTIVE (~12s ETA)</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 8-Stage Research Methodology Animated Pipeline Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> End-to-End Processing Architecture
            </h2>
            <span className="text-xs text-muted-foreground">
              Click any stage below to inspect technical formulas & hardware details
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {pipelineSteps.map((step) => {
              const Icon = step.icon;
              const isActive = activeStep === step.id;

              return (
                <Card
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={`transition-all duration-300 cursor-pointer overflow-hidden relative border ${
                    isActive
                      ? 'bg-card border-primary ring-2 ring-primary/40 shadow-xl scale-[1.02]'
                      : 'bg-card/60 hover:bg-card border-border/50 hover:border-border'
                  }`}
                >
                  <div className={`h-1.5 w-full bg-gradient-to-r ${step.color}`} />

                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge className={`${step.badgeColor} font-mono text-xs border`}>
                        Stage {step.id + 1}
                      </Badge>
                      {isActive && (
                        <Badge className="bg-primary text-primary-foreground text-[10px] animate-pulse">
                          Active Stage
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base font-bold flex items-center gap-2 mt-2">
                      <div className={`p-2 rounded-lg bg-gradient-to-br ${step.color} text-white shadow-sm`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      {step.name}
                    </CardTitle>
                    <CardDescription className="text-xs font-medium text-foreground/80 mt-1">
                      {step.subtitle}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 text-xs space-y-3 text-muted-foreground">
                    <p className="leading-relaxed">{step.description}</p>

                    <div className="bg-background/80 rounded-lg p-2.5 border border-border/40 space-y-1.5 font-mono text-[11px]">
                      {step.technical.map((tech, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-foreground/90">
                          <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
                          <span>{tech}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Detailed Breakdown & Research Output Verification Section */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" /> Research Outputs & Verification Matrix
            </CardTitle>
            <CardDescription className="text-xs">
              Summary of key outputs generated from the dual-sensor vibration processing pipeline.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 space-y-1">
                <div className="flex items-center justify-between text-cyan-400">
                  <span className="text-xs font-semibold uppercase">Approach Alert</span>
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
                <div className="text-2xl font-extrabold text-foreground">Early Warning</div>
                <p className="text-[11px] text-muted-foreground">Triggers ~10-15s before arrival</p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                <div className="flex items-center justify-between text-emerald-400">
                  <span className="text-xs font-semibold uppercase">Train Speed</span>
                  <Gauge className="w-4 h-4" />
                </div>
                <div className="text-2xl font-extrabold text-foreground">{calculatedSpeed} km/h</div>
                <p className="text-[11px] text-muted-foreground">Calculated via v = d / Δt</p>
              </div>

              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-1">
                <div className="flex items-center justify-between text-purple-400">
                  <span className="text-xs font-semibold uppercase">Direction</span>
                  <Compass className="w-4 h-4" />
                </div>
                <div className="text-2xl font-extrabold text-foreground">
                  {direction === 'L2R' ? 'Left ➔ Right' : 'Right ➔ Left'}
                </div>
                <p className="text-[11px] text-muted-foreground">Determined by Sensor A vs B phase</p>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                <div className="flex items-center justify-between text-amber-400">
                  <span className="text-xs font-semibold uppercase">Distance Est.</span>
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="text-2xl font-extrabold text-foreground">0.5 - 2.5 km</div>
                <p className="text-[11px] text-muted-foreground">Derived from FFT energy amplitude</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
