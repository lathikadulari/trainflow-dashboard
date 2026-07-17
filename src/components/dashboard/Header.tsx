import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Train, Bell, LayoutDashboard, FileText, LogOut, Activity, Cpu, BarChart3, Sliders, Filter, BrainCircuit } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { mockLogs } from "@/data/mockData";

const Header = () => {
  const location = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="glass border-b border-border/50 px-6 py-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 glow-primary">
              <Train className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">TrainTrack</h1>
              <p className="text-xs text-muted-foreground">Real-time Monitoring System</p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg overflow-x-auto max-w-[50vw] lg:max-w-none scrollbar-none">
            <Link
              to="/"
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
                location.pathname === "/"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <Link
              to="/sensors"
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
                location.pathname === "/sensors"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
            >
              <Activity className="w-4 h-4" />
              Live Sensors
            </Link>
            <Link
              to="/makumbura"
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
                location.pathname === "/makumbura"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
            >
              <Cpu className="w-4 h-4" />
              Makumbura Raw
            </Link>
            <Link
              to="/analysis"
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
                location.pathname === "/analysis"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
            >
              <BarChart3 className="w-4 h-4" />
              Data Analysis
            </Link>
            <Link
              to="/noise"
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
                location.pathname === "/noise"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
            >
              <Sliders className="w-4 h-4" />
              Noise Calibration
            </Link>
            <Link
              to="/filter"
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
                location.pathname === "/filter"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
            >
              <Filter className="w-4 h-4" />
              Noise Filter
            </Link>
            <Link
              to="/ml-analysis"
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
                location.pathname === "/ml-analysis"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
            >
              <BrainCircuit className="w-4 h-4" />
              ML Analysis
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 border border-success/30">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
            <span className="text-xs font-medium text-success">System Online</span>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer outline-none">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full animate-pulse" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-4 border-b border-border/50">
                <h4 className="font-semibold text-sm">Notifications</h4>
                <p className="text-xs text-muted-foreground">Recent system logs</p>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {mockLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="p-3 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={cn(
                        "text-[10px] font-mono px-1.5 py-0.5 rounded uppercase",
                        log.level === 'error' ? "bg-destructive/10 text-destructive" :
                          log.level === 'warning' ? "bg-warning/10 text-warning" :
                            "bg-primary/10 text-primary"
                      )}>
                        {log.level}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground line-clamp-2">{log.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Source: {log.source}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-border/50 bg-muted/20">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs h-8"
                  onClick={() => navigate('/logs')}
                >
                  <FileText className="w-3 h-3 mr-2" />
                  View All Logs
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
