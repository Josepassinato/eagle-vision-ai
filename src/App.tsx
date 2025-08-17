import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Setup from "./pages/Setup";
import SimpleDashboard from "./pages/SimpleDashboard";
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
import TestDVR from "./pages/TestDVR";
import DVRAnalytics from "./pages/DVRAnalytics";
import DemoPublic from "./pages/DemoPublic";
import Safety from "./pages/admin/Safety";
import EduBehavior from "./pages/admin/EduBehavior";
import Live from "./pages/Live";
import EventsPage from "./pages/EventsPage";
import Analytics from "./pages/Analytics";
import Onboarding from "./pages/Onboarding";
import WorkspaceManager from "./pages/WorkspaceManager";
import EdgeDeviceManager from "./pages/EdgeDeviceManager";
import PrivacyCompliance from "./pages/admin/PrivacyCompliance";
import HealthMonitoring from "./pages/admin/HealthMonitoring";
import SystemParameters from "./pages/admin/SystemParameters";
import DeploymentChecklist from "./pages/admin/DeploymentChecklist";
import ONVIFManager from "./pages/admin/ONVIFManager";
import OperationalQuality from "./pages/admin/OperationalQuality";
import ONVIFOnboarding from "./pages/admin/ONVIFOnboarding";
import TensorRTOptimization from "./pages/admin/TensorRTOptimization";
import ReIDOptimization from "./pages/admin/ReIDOptimization";
import TechnicalTesting from "./pages/admin/TechnicalTesting";
import Vision4Church from "./pages/admin/Vision4Church";
import VerticalDashboard from "./pages/admin/VerticalDashboard";
import GlobalNavActions from "./components/GlobalNavActions";
import AIAssistant from "./components/AIAssistant";
import { PWAInstallBanner } from "./components/PWAInstallBanner";
import { OfflineIndicator } from "./components/OfflineIndicator";

const queryClient = new QueryClient();

const App = () => (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PWAInstallBanner />
        <OfflineIndicator />
        <BrowserRouter>
        <GlobalNavActions />
        <AIAssistant />
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/live" element={<ProtectedRoute><Live /></ProtectedRoute>} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/demo" element={<DemoPublic />} />
          <Route path="/workspace" element={<WorkspaceManager />} />
          <Route path="/edge" element={<EdgeDeviceManager />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/setup" element={<ProtectedRoute><Setup /></ProtectedRoute>} />
          <Route path="/dashboard-simple" element={<ProtectedRoute><SimpleDashboard /></ProtectedRoute>} />
          <Route path="/test-dvr" element={<ProtectedRoute><TestDVR /></ProtectedRoute>} />
          <Route path="/dvr-analytics" element={<ProtectedRoute><DVRAnalytics /></ProtectedRoute>} />
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
            <Route path="safety" element={<Safety />} />
            <Route path="edubehavior" element={<EduBehavior />} />
            <Route path="privacy" element={<PrivacyCompliance />} />
            <Route path="health" element={<HealthMonitoring />} />
            <Route path="parameters" element={<SystemParameters />} />
            <Route path="technical-testing" element={<TechnicalTesting />} />
            <Route path="church" element={<Vision4Church />} />
            <Route path="vertical-dashboard" element={<VerticalDashboard />} />
            <Route path="deployment" element={<DeploymentChecklist />} />
            <Route path="onvif-onboarding" element={<ONVIFOnboarding />} />
            <Route path="tensorrt-optimization" element={<TensorRTOptimization />} />
            <Route path="reid-optimization" element={<ReIDOptimization />} />
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
