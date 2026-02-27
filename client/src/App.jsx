import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import SetupPage from './pages/SetupPage';
import LoginPage from './pages/LoginPage';
import UploadPage from './pages/UploadPage';
import JobsPage from './pages/JobsPage';
import DashboardPage from './pages/DashboardPage';
import AccountDetailPage from './pages/AccountDetailPage';

function AppRoutes() {
  const { loading, authenticated, requiresAuth, setupCompleted } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // First-time setup: no env var password and no DB password yet
  if (!setupCompleted && !requiresAuth) {
    return <SetupPage />;
  }

  if (requiresAuth && !authenticated) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:id" element={<DashboardPage />} />
        <Route path="/accounts/:id" element={<AccountDetailPage />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
