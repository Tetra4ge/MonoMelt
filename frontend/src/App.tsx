import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AnalysisPage from './pages/AnalysisPage';
import AuthCallback from './pages/AuthCallback';
import PlanningPage from './pages/PlanningPage';
import ExportPage from './pages/ExportPage';
import DeploymentPage from './pages/DeploymentPage';
import ReportPage from './pages/ReportPage';
import TwinPage from './pages/TwinPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { useAuthStore } from './stores/authStore';

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard/projects/:projectId/analysis" 
          element={
            <ProtectedRoute>
              <AnalysisPage />
            </ProtectedRoute>
          } 
        />
        <Route
          path="/dashboard/projects/:projectId/planning"
          element={
            <ProtectedRoute>
              <PlanningPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/projects/:projectId/export"
          element={
            <ProtectedRoute>
              <ExportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/projects/:projectId/deployment"
          element={
            <ProtectedRoute>
              <DeploymentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/projects/:projectId/report"
          element={
            <ProtectedRoute>
              <ReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/projects/:projectId/twin"
          element={
            <ProtectedRoute>
              <TwinPage />
            </ProtectedRoute>
          }
        />
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
