import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Competitors from './pages/Competitors';
import Sources from './pages/Sources';
import Themes from './pages/Themes';
import Actions from './pages/Actions';
import Reports from './pages/Reports';
import Monitoring from './pages/Monitoring';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/competitors" element={<Competitors />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="/themes" element={<Themes />} />
        <Route path="/actions" element={<Actions />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
