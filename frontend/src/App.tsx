import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AnalysisPage from './pages/AnalysisPage';
import PlanningPage from './pages/PlanningPage';
import AuthCallback from './pages/AuthCallback';
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
          path="/dashboard/projects/:projectId/plans" 
          element={
            <ProtectedRoute>
              <PlanningPage />
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
