import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';

// Eagerly loaded components
import ProtectedRoute from './components/auth/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';

// Lazy loaded components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProjectOverviewPage = lazy(() => import('./pages/ProjectOverviewPage'));
const ProjectSourcesPage = lazy(() => import('./pages/ProjectSourcesPage'));
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));
const ScenariosPage = lazy(() => import('./pages/ScenariosPage'));
const PlanningPage = lazy(() => import('./pages/PlanningPage'));
const BlueprintPage = lazy(() => import('./pages/BlueprintPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Fallback loader for Suspense
const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gray-950 text-lime-400 font-mono text-sm">
    <div className="flex flex-col items-center gap-2">
      <span className="animate-pulse">Loading module...</span>
    </div>
  </div>
);

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          
          <Route 
            path="/app/projects" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/app/projects/:projectId/overview" 
            element={
              <ProtectedRoute>
                <ProjectOverviewPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/app/projects/:projectId/sources" 
            element={
              <ProtectedRoute>
                <ProjectSourcesPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/app/projects/:projectId/analysis" 
            element={
              <ProtectedRoute>
                <AnalysisPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/app/projects/:projectId/scenarios" 
            element={
              <ProtectedRoute>
                <ScenariosPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/app/projects/:projectId/plans" 
            element={
              <ProtectedRoute>
                <PlanningPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/app/projects/:projectId/blueprints" 
            element={
              <ProtectedRoute>
                <BlueprintPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/app/settings" 
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            } 
          />
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
