import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AdminLayout from "./layouts/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthPage from "./pages/Auth";
import Dashboard from "./pages/admin/Dashboard";
import Events from "./pages/admin/Events";
import People from "./pages/admin/People";
import Config from "./pages/admin/Config";
import Metrics from "./pages/admin/Metrics";
import MapView from "./pages/admin/MapView";
import Antitheft from "./pages/admin/Antitheft";
import Credits from "./pages/admin/Credits";
import CreditSuccess from "./pages/admin/CreditSuccess";
import Demo from "./pages/admin/Demo";
import Live from "./pages/Live";
import EventsPage from "./pages/EventsPage";
import Analytics from "./pages/Analytics";
import Onboarding from "./pages/Onboarding";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/live" element={<Live />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/admin" element={<Navigate to="/app/dashboard" replace />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="events" element={<Events />} />
            <Route path="people" element={<People />} />
            <Route path="config" element={<Config />} />
            <Route path="metrics" element={<Metrics />} />
            <Route path="map" element={<MapView />} />
            <Route path="antitheft" element={<Antitheft />} />
            <Route path="credits" element={<Credits />} />
            <Route path="credits/success" element={<CreditSuccess />} />
            <Route path="demo" element={<Demo />} />
          </Route>
          <Route path="/" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
