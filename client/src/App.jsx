import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';
import AccountDetailPage from './pages/AccountDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/jobs/:id" element={<DashboardPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
