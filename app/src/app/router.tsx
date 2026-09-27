import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminShell } from '@/components/admin-shell';
import { useAuthStore } from '@/stores/auth-store';
import { DashboardPage } from '@/pages/dashboard-page';
import { AuditPage } from '@/pages/audit-page';
import { LeadDetailPage } from '@/pages/lead-detail-page';
import { LeadsPage } from '@/pages/leads-page';
import { LoginPage } from '@/pages/login-page';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function ProtectedShell() {
  return (
    <ProtectedRoute>
      <AdminShell />
    </ProtectedRoute>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/:id" element={<LeadDetailPage />} />
        <Route path="/audit" element={<AuditPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
