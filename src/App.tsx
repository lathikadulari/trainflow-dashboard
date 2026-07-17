import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Logs from "./pages/Logs";
import Index from "./pages/Index";
import StationDetails from "./pages/StationDetails";
import LineStations from "./pages/LineStations";
import SensorsLive from "./pages/SensorsLive";
import MakumburaRaw from "./pages/MakumburaRaw";
import DataAnalysis from "./pages/DataAnalysis";
import NoiseCalibration from "./pages/NoiseCalibration";
import NoiseFilter from "./pages/NoiseFilter";
import { MLAnalysis } from "./pages/MLAnalysis";
import NotFound from "./pages/NotFound";

import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "./pages/Login";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Index />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/station/:id" element={<StationDetails />} />
              <Route path="/line/:lineName" element={<LineStations />} />
              <Route path="/sensors" element={<SensorsLive />} />
              <Route path="/makumbura" element={<MakumburaRaw />} />
              <Route path="/analysis" element={<DataAnalysis />} />
              <Route path="/noise" element={<NoiseCalibration />} />
              <Route path="/filter" element={<NoiseFilter />} />
              <Route path="/ml-analysis" element={<MLAnalysis />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
