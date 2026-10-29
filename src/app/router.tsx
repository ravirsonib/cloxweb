import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AdminShell } from '@/components/admin-shell';
import { isIntentionalLogoutRedirect } from '@/lib/auth-session';
import { useAuthStore } from '@/stores/auth-store';
import { AdminRole, AppRole } from '@/shared/types';
import { HomePage } from '@/pages/home-page';
import { AuditPage } from '@/pages/audit-page';
import { LeadDetailPage } from '@/pages/lead-detail-page';
import { AdminJobDetailPage, AdminJobsPage } from '@/pages/admin-jobs-page';
import { CompaniesPage } from '@/pages/companies-page';
import { LeadsPage } from '@/pages/leads-page';
import { LoginPage } from '@/pages/login-page';
import { ComplianceCasePage, ComplianceQueuePage } from '@/pages/compliance-pages';
import { DocumentsUploadPage } from '@/pages/documents-upload-page';
import { AccountPage } from '@/pages/account-page';
import { CarrierRegisterPage } from '@/pages/carrier-register-page';
import { CarrierOnboardingPage } from '@/pages/carrier-onboarding-page';
import { CarrierFleetPage } from '@/pages/carrier-fleet-page';
import { CarrierDriversPage } from '@/pages/carrier-drivers-page';
import { DriverInvitePage } from '@/pages/driver-invite-page';
import { DriverOnboardingPage } from '@/pages/driver-onboarding-page';
import { AdminInvitePage } from '@/pages/admin-invite-page';
import { PartnerOnboardingPage } from '@/pages/partner-onboarding-page';
import { OpsPartnersPage } from '@/pages/ops-partners-page';
import {
  GrowthInvitePage,
  GrowthPipelinePage,
  MyCarriersPage,
  MySendersPage,
} from '@/pages/growth-pages';
import { JobCreatePage, JobDetailPage, JobEditPage, JobsListPage } from '@/pages/jobs-pages';
import { MarketBoardPage } from '@/pages/market-board-page';
import { CarrierAssignmentsPage } from '@/pages/carrier-assignments-page';
import {
  CarrierExceptionDetailPage,
  CarrierExceptionsPage,
} from '@/pages/carrier-exceptions-page';
import { OpsExceptionsPage } from '@/pages/ops-exceptions-page';
import { DriverTripsPage, DriverTripDetailPage } from '@/pages/driver-trips-page';
import { SenderTrackPage } from '@/pages/sender-track-page';
import { SenderRegisterPage } from '@/pages/sender-register-page';
import { SenderOnboardingPage } from '@/pages/sender-onboarding-page';
import { SurchargesPage } from '@/pages/surcharges-page';
import { PlatformSettingsPage } from '@/pages/platform-settings-page';
import { RevenueSplitSettingsPage } from '@/pages/revenue-split-settings-page';
import { PartnerPerformancePage } from '@/pages/partner-performance-page';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const location = useLocation();
  if (!accessToken) {
    // Intentional sign-out: land on clean /login (do not keep previous page as ?next=).
    // Session expiry / deep-link still uses ?next= so the user can return after OTP.
    if (isIntentionalLogoutRedirect()) {
      return <Navigate to="/login" replace />;
    }
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}

/** Marketplace routes: wrong role (e.g. Super Admin) → login with switch + return path. */
function RequireRoles({
  roles,
  children,
}: {
  roles: readonly AppRole[];
  children: ReactNode;
}) {
  const role = useAuthStore((s) => s.role);
  const location = useLocation();
  if (!role || !roles.includes(role)) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}&switch=1`} replace />;
  }
  return children;
}

function SuperOnly({ children }: { children: ReactNode }) {
  const role = useAuthStore((s) => s.role);
  if (role !== AdminRole.SUPER_ADMIN) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function OpsOnly({ children }: { children: ReactNode }) {
  const role = useAuthStore((s) => s.role);
  const ok =
    role === AdminRole.SUPER_ADMIN ||
    role === AdminRole.STATE_MASTER ||
    role === AdminRole.LOCAL_BDE;
  if (!ok) {
    return <Navigate to="/" replace />;
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

function ComplianceCaseRoute() {
  const { id } = useParams();
  if (!id) return <Navigate to="/compliance" replace />;
  return <ComplianceCasePage caseId={id} />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register/sender" element={<SenderRegisterPage />} />
      <Route path="/register/carrier" element={<CarrierRegisterPage />} />
      <Route path="/driver/invite/:token" element={<DriverInvitePage />} />
      <Route path="/admin/invite/:token" element={<AdminInvitePage />} />
      <Route element={<ProtectedShell />}>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/leads"
          element={
            <SuperOnly>
              <LeadsPage />
            </SuperOnly>
          }
        />
        <Route
          path="/leads/:id"
          element={
            <SuperOnly>
              <LeadDetailPage />
            </SuperOnly>
          }
        />
        <Route
          path="/companies"
          element={
            <SuperOnly>
              <CompaniesPage />
            </SuperOnly>
          }
        />
        <Route
          path="/admin-jobs"
          element={
            <SuperOnly>
              <AdminJobsPage />
            </SuperOnly>
          }
        />
        <Route
          path="/admin-jobs/:id"
          element={
            <SuperOnly>
              <AdminJobDetailPage />
            </SuperOnly>
          }
        />
        <Route
          path="/ops/partners"
          element={
            <SuperOnly>
              <OpsPartnersPage />
            </SuperOnly>
          }
        />
        <Route
          path="/ops/growth"
          element={
            <RequireRoles roles={[AdminRole.LOCAL_BDE, AdminRole.STATE_MASTER, AdminRole.SUPER_ADMIN]}>
              <GrowthPipelinePage />
            </RequireRoles>
          }
        />
        <Route
          path="/ops/growth/invite"
          element={
            <RequireRoles roles={[AdminRole.LOCAL_BDE]}>
              <GrowthInvitePage />
            </RequireRoles>
          }
        />
        <Route
          path="/ops/my-senders"
          element={
            <RequireRoles roles={[AdminRole.LOCAL_BDE]}>
              <MySendersPage />
            </RequireRoles>
          }
        />
        <Route
          path="/ops/my-carriers"
          element={
            <RequireRoles roles={[AdminRole.LOCAL_BDE]}>
              <MyCarriersPage />
            </RequireRoles>
          }
        />
        <Route
          path="/partner/onboarding"
          element={
            <RequireRoles roles={[AdminRole.STATE_MASTER, AdminRole.LOCAL_BDE]}>
              <PartnerOnboardingPage />
            </RequireRoles>
          }
        />
        <Route
          path="/audit"
          element={
            <SuperOnly>
              <AuditPage />
            </SuperOnly>
          }
        />
        <Route
          path="/compliance"
          element={
            <OpsOnly>
              <ComplianceQueuePage />
            </OpsOnly>
          }
        />
        <Route
          path="/compliance/:id"
          element={
            <OpsOnly>
              <ComplianceCaseRoute />
            </OpsOnly>
          }
        />
        <Route
          path="/sender/onboarding"
          element={
            <RequireRoles roles={[AppRole.SENDER]}>
              <SenderOnboardingPage />
            </RequireRoles>
          }
        />
        <Route
          path="/carrier/onboarding"
          element={
            <RequireRoles roles={[AppRole.TRANSPORT_COMPANY]}>
              <CarrierOnboardingPage />
            </RequireRoles>
          }
        />
        <Route
          path="/carrier/fleet"
          element={
            <RequireRoles roles={[AppRole.TRANSPORT_COMPANY]}>
              <CarrierFleetPage />
            </RequireRoles>
          }
        />
        <Route
          path="/carrier/drivers"
          element={
            <RequireRoles roles={[AppRole.TRANSPORT_COMPANY]}>
              <CarrierDriversPage />
            </RequireRoles>
          }
        />
        <Route
          path="/driver/onboarding"
          element={
            <RequireRoles roles={[AppRole.DRIVER]}>
              <DriverOnboardingPage />
            </RequireRoles>
          }
        />
        <Route
          path="/jobs"
          element={
            <RequireRoles roles={[AppRole.SENDER]}>
              <JobsListPage />
            </RequireRoles>
          }
        />
        <Route path="/jobs/new" element={<JobCreatePage />} />
        <Route path="/jobs/:id/edit" element={<JobEditPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route
          path="/market"
          element={
            <RequireRoles roles={[AppRole.TRANSPORT_COMPANY]}>
              <MarketBoardPage />
            </RequireRoles>
          }
        />
        <Route
          path="/assignments"
          element={
            <RequireRoles roles={[AppRole.TRANSPORT_COMPANY]}>
              <CarrierAssignmentsPage />
            </RequireRoles>
          }
        />
        <Route
          path="/carrier/exceptions"
          element={
            <RequireRoles roles={[AppRole.TRANSPORT_COMPANY]}>
              <CarrierExceptionsPage />
            </RequireRoles>
          }
        />
        <Route
          path="/carrier/exceptions/:id"
          element={
            <RequireRoles roles={[AppRole.TRANSPORT_COMPANY]}>
              <CarrierExceptionDetailPage />
            </RequireRoles>
          }
        />
        <Route
          path="/ops/exceptions"
          element={
            <RequireRoles roles={[AdminRole.SUPER_ADMIN, AdminRole.STATE_MASTER]}>
              <OpsExceptionsPage />
            </RequireRoles>
          }
        />
        <Route
          path="/trips"
          element={
            <RequireRoles roles={[AppRole.DRIVER]}>
              <DriverTripsPage />
            </RequireRoles>
          }
        />
        <Route
          path="/trips/:tripId"
          element={
            <RequireRoles roles={[AppRole.DRIVER]}>
              <DriverTripDetailPage />
            </RequireRoles>
          }
        />
        <Route path="/jobs/:jobId/track" element={<SenderTrackPage />} />
        <Route path="/surcharges" element={<SurchargesPage />} />
        <Route
          path="/platform-settings"
          element={
            <SuperOnly>
              <PlatformSettingsPage />
            </SuperOnly>
          }
        />
        <Route
          path="/revenue-split"
          element={
            <SuperOnly>
              <RevenueSplitSettingsPage />
            </SuperOnly>
          }
        />
        <Route
          path="/partner-performance"
          element={
            <SuperOnly>
              <PartnerPerformancePage />
            </SuperOnly>
          }
        />
        <Route
          path="/documents/upload"
          element={
            <RequireRoles
              roles={[AppRole.SENDER, AppRole.TRANSPORT_COMPANY, AppRole.DRIVER]}
            >
              <DocumentsUploadPage />
            </RequireRoles>
          }
        />
        <Route path="/qa/upload" element={<Navigate to="/documents/upload" replace />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
