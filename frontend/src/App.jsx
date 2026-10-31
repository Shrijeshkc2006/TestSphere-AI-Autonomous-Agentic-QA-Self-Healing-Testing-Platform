import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import NewProjectPage from './pages/NewProjectPage.jsx';
import ProjectDetailPage from './pages/ProjectDetailPage.jsx';
import TestPlansPage from './pages/TestPlansPage.jsx';
import NewPlanPage from './pages/NewPlanPage.jsx';
import PlanDetailPage from './pages/PlanDetailPage.jsx';
import RunDetailPage from './pages/RunDetailPage.jsx';
import RecentRunsPage from './pages/RecentRunsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { Spinner } from './components/ui.jsx';

/** Routes that require a logged-in user */
function ProtectedLayout() {
  const { user, loading } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--bg-main)',
        }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />
      <main className="content-area">
        {/* Mobile top bar for hamburger button */}
        <div
          style={{
            display: 'none',
            alignItems: 'center',
            padding: '8px 16px',
            borderBottom: '1px solid var(--border-primary)',
            background: 'var(--bg-sidebar)',
          }}
          className="mobile-header-bar"
        >
          <button
            className="btn-icon"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>
          <span
            style={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: 'var(--text-primary)',
              marginLeft: 8,
            }}
          >
            TestSphere
          </span>
        </div>

        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/new" element={<NewProjectPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/projects/:projectId/plans/new" element={<NewPlanPage />} />
          <Route path="/plans" element={<TestPlansPage />} />
          <Route path="/plans/:planId" element={<PlanDetailPage />} />
          <Route path="/runs" element={<RecentRunsPage />} />
          <Route path="/runs/:runId" element={<RunDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

      <style>{`
        @media (max-width: 840px) {
          .mobile-header-bar {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}

/** Public landing page — redirect to dashboard if already logged in */
function LandingRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

/** Public routes (login / register) */
function PublicRoute({ element }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return element;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingRoute />} />
          <Route path="/login" element={<PublicRoute element={<LoginPage />} />} />
          <Route path="/register" element={<PublicRoute element={<RegisterPage />} />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
