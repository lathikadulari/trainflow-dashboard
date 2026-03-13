
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mockStations, mockTrainApproaches } from '@/data/mockData';
import { TrainApproach } from '@/types/train';
import { ArrowLeft, MapPin, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/dashboard/Header';
import TrainApproachCard from '@/components/dashboard/TrainApproachCard';
import { cn } from '@/lib/utils';
import SensorSimulation from './SensorSimulation';

const StationDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const station = mockStations.find((s) => s.id === id);

    if (!station) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <main className="container mx-auto px-4 py-8 flex flex-col items-center justify-center h-[calc(100vh-80px)]">
                    <h2 className="text-2xl font-bold mb-4">Station Not Found</h2>
                    <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
                </main>
            </div>
        );
    }

    const [approaches, setApproaches] = useState<TrainApproach[]>(() => {
        const existingForStation = mockTrainApproaches.filter(a => a.stationId === id);

        // If we have real mock data or if id is undefined, return original
        if (existingForStation.length > 0 || !id) {
            return mockTrainApproaches;
        }

        // Otherwise generate 2-3 random approaches so the UI isn't empty
        const destinations = ['Colombo Fort', 'Kandy', 'Galle', 'Matara', 'Jaffna', 'Badulla', 'Trincomalee'];
        const statuses = ['approaching', 'approaching', 'passed'] as const;

        const generatedApproaches: TrainApproach[] = Array.from({ length: Math.floor(Math.random() * 2) + 2 }).map((_, i) => ({
            id: `gen-${id}-${Date.now()}-${i}`,
            trainId: `TRN-${Math.floor(1000 + Math.random() * 9000)}`,
            stationId: id,
            stationName: station?.name || 'Unknown',
            sensorId: `s${id}-${i + 1}`,
            speed: Math.floor(Math.random() * 60) + 30, // 30-90 km/h
            distance: parseFloat((Math.random() * 10 + 2).toFixed(1)), // 2-12 km
            destination: destinations[Math.floor(Math.random() * destinations.length)],
            timestamp: new Date(),
            status: statuses[Math.floor(Math.random() * statuses.length)]
        }));

        return [...mockTrainApproaches, ...generatedApproaches];
    });

    const stationApproaches = approaches.filter((a) => a.stationId === id);

    useEffect(() => {
        const interval = setInterval(() => {
            setApproaches(prev => prev.map(approach => {
                if (approach.status === 'approaching' && approach.stationId === id) {
                    // Update speed (random fluctuation)
                    const speedChange = Math.floor(Math.random() * 5) - 2;
                    let newSpeed = Math.max(0, Math.min(120, approach.speed + speedChange));

                    if (approach.speed === 0 && approach.distance > 0) newSpeed = 30; // Start moving if stopped but not arrived

                    // Update distance (Distance = Speed * Time)
                    // Speed in km/h, Time = 1s (1/3600 h)
                    // Distance reduction in km = Speed / 3600
                    const distanceReduction = newSpeed / 3600;
                    let newDistance = Math.max(0, approach.distance - distanceReduction);

                    let newStatus: TrainApproach['status'] = approach.status;
                    if (newDistance <= 0.1) {
                        newDistance = 0;
                        newSpeed = 0;
                        newStatus = 'passed';
                    }

                    return {
                        ...approach,
                        speed: newSpeed,
                        distance: newDistance,
                        status: newStatus
                    };
                }
                return approach;
            }));
        }, 1000);

        return () => clearInterval(interval);
    }, [id]);
    const onlineSensors = station.sensors.filter((s) => s.status === 'online').length;

    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="container mx-auto px-4 py-8">
                <Button
                    variant="ghost"
                    className="mb-6 pl-0 hover:pl-2 transition-all"
                    onClick={() => navigate('/')}
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                </Button>

                <div className="mb-8 p-6 glass rounded-xl border border-border/50">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-primary/10">
                                <MapPin className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-foreground">{station.name}</h1>
                                <div className="flex items-center gap-3 mt-1 text-muted-foreground">
                                    <span className="font-mono bg-secondary px-2 py-0.5 rounded text-sm">{station.code}</span>
                                    {station.province && (
                                        <span>• {station.province} Province</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${onlineSensors > 0 ? 'bg-success animate-pulse-glow' : 'bg-destructive'}`} />
                                <span className="text-sm font-medium">
                                    {onlineSensors} / {station.sensors.length} Sensors Online
                                </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                Total Approaches: <span className="text-foreground font-mono">{station.totalApproaches}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                        {station.sensors.map((sensor) => (
                            <div
                                key={sensor.id}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border',
                                    sensor.status === 'online'
                                        ? 'bg-success/5 border-success/20 text-success-foreground'
                                        : 'bg-destructive/5 border-destructive/20 text-destructive-foreground'
                                )}
                            >
                                {sensor.status === 'online' ? (
                                    <Wifi className="w-3.5 h-3.5" />
                                ) : (
                                    <WifiOff className="w-3.5 h-3.5" />
                                )}
                                <span className="font-medium">{sensor.name}</span>
                                <span className="text-xs opacity-70 ml-1">
                                    ({sensor.id})
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    Live Train Approaches
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {stationApproaches.length}
                    </span>
                </h2>

                {stationApproaches.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {stationApproaches.map((approach) => (
                            <TrainApproachCard key={approach.id} approach={approach} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted-foreground bg-secondary/20 rounded-xl border border-dashed border-border">
                        <p>No active train approaches for this station.</p>
                    </div>
                )}

                {station.name.toLowerCase() === 'makumbura' && (
                    <div className="mt-12 mb-8">
                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                            Live Sensor Graphs
                        </h2>
                        <SensorSimulation isEmbedded={true} />
                    </div>
                )}
            </main>
        </div>
    );
};

export default StationDetails;
