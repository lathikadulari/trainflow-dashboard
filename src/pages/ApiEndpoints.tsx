import { useState, useEffect } from 'react';
import Header from '@/components/dashboard/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Code2, 
  Play, 
  Copy, 
  Check, 
  Radio, 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  Train, 
  Zap,
  Globe,
  Terminal,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface Endpoint {
  id: string;
  name: string;
  method: 'GET';
  path: string;
  description: string;
  params?: { name: string; type: string; default: string; description: string }[];
  sampleParams?: Record<string, string>;
}

const endpoints: Endpoint[] = [
  {
    id: 'latest',
    name: 'Latest Train Alerts',
    method: 'GET',
    path: '/api/v1/alerts/latest',
    description: 'Retrieve latest train detection events, station approach alerts, and vibration sensor logs.',
    params: [
      { name: 'limit', type: 'number', default: '20', description: 'Max number of records to return' },
      { name: 'station', type: 'string', default: '', description: 'Filter by station name (e.g. Makumbura)' }
    ],
    sampleParams: { limit: '10', station: 'Makumbura' }
  },
  {
    id: 'active-trains',
    name: 'Active Approaching Trains',
    method: 'GET',
    path: '/api/v1/alerts/active-trains',
    description: 'Get currently active or approaching trains with speed, direction confidence, and ETA parameters.'
  },
  {
    id: 'speed-violations',
    name: 'Speed Violations & Driver Compliance',
    method: 'GET',
    path: '/api/v1/alerts/speed-violations',
    description: 'Filter train logs exceeding standard safety speed limits to evaluate driver compliance.',
    params: [
      { name: 'speedLimit', type: 'number', default: '60', description: 'Speed threshold in km/h' },
      { name: 'limit', type: 'number', default: '50', description: 'Max violation records' }
    ],
    sampleParams: { speedLimit: '50', limit: '10' }
  },
  {
    id: 'stream',
    name: 'Live Real-Time SSE Stream',
    method: 'GET',
    path: '/api/v1/alerts/stream',
    description: 'Server-Sent Events (SSE) live connection stream delivering instant push notifications on train detection & speed alerts.'
  },
  {
    id: 'health',
    name: 'API Health & Status',
    method: 'GET',
    path: '/api/v1/alerts/health',
    description: 'Check external API health, server uptime, version, and active real-time SSE subscriber connections.'
  }
];

export default function ApiEndpoints() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>(endpoints[0]);
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [apiKey, setApiKey] = useState('trainflow-demo-key');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  
  // Real-time SSE stream state
  const [sseConnected, setSseConnected] = useState(false);
  const [sseMessages, setSseMessages] = useState<any[]>([]);

  useEffect(() => {
    // Reset query params when selected endpoint changes
    if (selectedEndpoint.sampleParams) {
      setQueryParams(selectedEndpoint.sampleParams);
    } else {
      setQueryParams({});
    }
  }, [selectedEndpoint]);

  // Connect to SSE stream
  useEffect(() => {
    const sseUrl = '/api/v1/alerts/stream';
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      setSseConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        setSseMessages(prev => [parsed, ...prev.slice(0, 19)]);
      } catch {
        setSseMessages(prev => [{ raw: event.data, timestamp: new Date().toISOString() }, ...prev.slice(0, 19)]);
      }
    };

    eventSource.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleTestApi = async () => {
    setLoading(true);
    setResponse(null);
    setHttpStatus(null);
    const startTime = performance.now();

    try {
      const url = new URL(selectedEndpoint.path, window.location.origin);
      Object.entries(queryParams).forEach(([key, val]) => {
        if (val) url.searchParams.append(key, val);
      });

      const res = await fetch(url.toString(), {
        headers: {
          'X-API-Key': apiKey,
          'Accept': 'application/json'
        }
      });

      const endTime = performance.now();
      setResponseTime(Math.round(endTime - startTime));
      setHttpStatus(res.status);

      const data = await res.json();
      setResponse(data);
      toast.success(`Request successful (${res.status} OK)`);
    } catch (err: any) {
      const endTime = performance.now();
      setResponseTime(Math.round(endTime - startTime));
      setHttpStatus(500);
      setResponse({ error: 'Failed to connect to backend server', details: err.message });
      toast.error('API Request failed');
    } finally {
      setLoading(false);
    }
  };

  const getFullUrl = () => {
    const url = new URL(selectedEndpoint.path, window.location.origin);
    Object.entries(queryParams).forEach(([key, val]) => {
      if (val) url.searchParams.append(key, val);
    });
    return url.toString();
  };

  const getCurlCode = () => {
    return `curl -X GET "${getFullUrl()}" \\\n  -H "X-API-Key: ${apiKey}" \\\n  -H "Accept: application/json"`;
  };

  const getFetchCode = () => {
    return `fetch("${getFullUrl()}", {\n  method: "GET",\n  headers: {\n    "X-API-Key": "${apiKey}",\n    "Accept": "application/json"\n  }\n})\n.then(res => res.json())\n.then(data => console.log(data));`;
  };

  const getPythonCode = () => {
    return `import requests\n\nurl = "${getFullUrl()}"\nheaders = {\n    "X-API-Key": "${apiKey}"\n}\n\nresponse = requests.get(url, headers=headers)\nprint(response.json())`;
  };

  const getSseCode = () => {
    return `const eventSource = new EventSource("${window.location.origin}/api/v1/alerts/stream");\n\neventSource.onmessage = (event) => {\n  const alert = JSON.parse(event.data);\n  console.log("Real-time Train Alert:", alert);\n};`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 flex items-center gap-1">
                <Globe className="w-3 h-3" /> External Developer API v1
              </Badge>
              <Badge variant="outline" className="bg-success/10 text-success border-success/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Public & Partner Gateway
              </Badge>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <Terminal className="w-8 h-8 text-primary" /> API Endpoints Hub
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Connect external apps, railway department software, and mobile services to live TrainFlow alerts and speed monitoring data.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-secondary/60 px-3 py-2 rounded-lg border border-border/50 text-xs">
              <div className={`w-2.5 h-2.5 rounded-full ${sseConnected ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
              <span>SSE Stream: <strong className={sseConnected ? 'text-success' : 'text-destructive'}>{sseConnected ? 'Connected' : 'Disconnected'}</strong></span>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar - Endpoint List */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Available Endpoints</h2>
            {endpoints.map((ep) => (
              <div
                key={ep.id}
                onClick={() => setSelectedEndpoint(ep)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedEndpoint.id === ep.id
                    ? 'bg-primary/10 border-primary/50 shadow-md ring-1 ring-primary/30'
                    : 'bg-card/60 hover:bg-card border-border/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-none font-mono text-xs">
                    {ep.method}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground truncate">{ep.path}</span>
                </div>
                <h3 className="font-semibold text-sm text-foreground">{ep.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ep.description}</p>
              </div>
            ))}

            {/* Live SSE Stream Monitor Card */}
            <Card className="bg-card/40 border-border/50 mt-6">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-cyan-400">
                  <Radio className="w-4 h-4 animate-pulse" /> Live SSE Stream Monitor
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time push alerts from <code className="text-xs bg-muted px-1 py-0.5 rounded">/stream</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="bg-black/60 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[11px] space-y-2 border border-border/40 scrollbar-thin">
                  {sseMessages.length === 0 ? (
                    <div className="text-muted-foreground text-center py-16 flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-primary/60" />
                      Waiting for real-time train alerts...
                    </div>
                  ) : (
                    sseMessages.map((msg, idx) => (
                      <div key={idx} className="p-1.5 rounded bg-white/5 border border-white/5 space-y-1">
                        <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                          <span className="text-cyan-400 font-bold">{msg.event || 'message'}</span>
                          <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}</span>
                        </div>
                        <pre className="text-slate-300 whitespace-pre-wrap break-all">{JSON.stringify(msg.data || msg, null, 2)}</pre>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content - API Tester & Documentation */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="bg-card border-border/50">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-none font-mono text-sm px-3 py-1">
                      {selectedEndpoint.method}
                    </Badge>
                    <span className="font-mono text-lg font-bold text-foreground">{selectedEndpoint.path}</span>
                  </div>
                  <Button 
                    onClick={handleTestApi} 
                    disabled={loading}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-2 shadow-lg"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                    Send Request
                  </Button>
                </div>
                <CardDescription className="text-sm mt-2 text-muted-foreground">
                  {selectedEndpoint.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Parameters Section */}
                <div className="space-y-4 border-t border-border/50 pt-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Zap className="w-4 h-4 text-amber-400" /> Request Headers & Query Parameters
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">X-API-Key (Header)</label>
                      <Input 
                        value={apiKey} 
                        onChange={(e) => setApiKey(e.target.value)} 
                        placeholder="trainflow-demo-key"
                        className="font-mono text-xs bg-background/60"
                      />
                    </div>

                    {selectedEndpoint.params?.map((param) => (
                      <div key={param.name}>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">
                          {param.name} <span className="text-[10px] text-primary">({param.type})</span>
                        </label>
                        <Input
                          value={queryParams[param.name] || ''}
                          onChange={(e) => setQueryParams({ ...queryParams, [param.name]: e.target.value })}
                          placeholder={param.default}
                          className="font-mono text-xs bg-background/60"
                        />
                        <span className="text-[10px] text-muted-foreground block mt-0.5">{param.description}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Code Snippets Section */}
                <div className="border-t border-border/50 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-indigo-400" /> Integration Code Examples
                    </h3>
                  </div>

                  <Tabs defaultValue="curl" className="w-full">
                    <TabsList className="bg-secondary/60 grid grid-cols-4 w-full">
                      <TabsTrigger value="curl" className="text-xs">cURL</TabsTrigger>
                      <TabsTrigger value="fetch" className="text-xs">JavaScript</TabsTrigger>
                      <TabsTrigger value="python" className="text-xs">Python</TabsTrigger>
                      <TabsTrigger value="sse" className="text-xs">SSE Stream</TabsTrigger>
                    </TabsList>

                    <TabsContent value="curl" className="relative mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(getCurlCode())}
                        className="absolute right-2 top-2 h-7 px-2 text-xs bg-white/10 hover:bg-white/20 text-white"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      <pre className="bg-slate-950 text-emerald-400 p-4 rounded-lg font-mono text-xs overflow-x-auto border border-border/50">
                        {getCurlCode()}
                      </pre>
                    </TabsContent>

                    <TabsContent value="fetch" className="relative mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(getFetchCode())}
                        className="absolute right-2 top-2 h-7 px-2 text-xs bg-white/10 hover:bg-white/20 text-white"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      <pre className="bg-slate-950 text-indigo-300 p-4 rounded-lg font-mono text-xs overflow-x-auto border border-border/50">
                        {getFetchCode()}
                      </pre>
                    </TabsContent>

                    <TabsContent value="python" className="relative mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(getPythonCode())}
                        className="absolute right-2 top-2 h-7 px-2 text-xs bg-white/10 hover:bg-white/20 text-white"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      <pre className="bg-slate-950 text-amber-300 p-4 rounded-lg font-mono text-xs overflow-x-auto border border-border/50">
                        {getPythonCode()}
                      </pre>
                    </TabsContent>

                    <TabsContent value="sse" className="relative mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(getSseCode())}
                        className="absolute right-2 top-2 h-7 px-2 text-xs bg-white/10 hover:bg-white/20 text-white"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      <pre className="bg-slate-950 text-cyan-300 p-4 rounded-lg font-mono text-xs overflow-x-auto border border-border/50">
                        {getSseCode()}
                      </pre>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Response Output Section */}
                <div className="border-t border-border/50 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" /> Response Output
                    </h3>
                    {httpStatus && (
                      <div className="flex items-center gap-2">
                        <Badge className={`${httpStatus === 200 ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'} font-mono text-xs`}>
                          Status: {httpStatus}
                        </Badge>
                        {responseTime && (
                          <Badge variant="outline" className="font-mono text-xs">
                            {responseTime} ms
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-950 rounded-xl p-4 border border-border/60 min-h-48 font-mono text-xs overflow-x-auto">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                        Fetching endpoint response...
                      </div>
                    ) : response ? (
                      <pre className="text-slate-200">{JSON.stringify(response, null, 2)}</pre>
                    ) : (
                      <div className="text-muted-foreground text-center py-16">
                        Click <strong>"Send Request"</strong> above to test this API endpoint live.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
