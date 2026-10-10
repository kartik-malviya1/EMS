import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'sonner';
import { store } from './app/store';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RoleRedirect } from './routes/RoleRedirect';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { EmployeeDashboardPage } from './pages/employee/EmployeeDashboardPage';
import { EmployeeHistoryPage } from './pages/employee/EmployeeHistoryPage';
import { PageHeader } from './components/common/PageHeader';
import { EmptyState } from './components/common/EmptyState';

// Placeholders for future phases (Phase 9 & 10)
const PlaceholderPage: React.FC<{ title: string; subtitle: string }> = ({
  title,
  subtitle,
}) => (
  <div className="space-y-6">
    <PageHeader title={title} description={subtitle} />
    <EmptyState
      title={`${title} In Development`}
      description="This feature is scheduled for implementation in upcoming phases."
    />
  </div>
);

export function App() {
  return (
    <Provider store={store}>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Root Role Redirect */}
            <Route
              path="/"
              element={
                <ProtectedRoute withShell={false}>
                  <RoleRedirect />
                </ProtectedRoute>
              }
            />

            {/* Employee Area */}
            <Route
              path="/employee"
              element={
                <ProtectedRoute allowedRoles={['employee', 'manager', 'admin']}>
                  <EmployeeDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/history"
              element={
                <ProtectedRoute allowedRoles={['employee', 'manager', 'admin']}>
                  <EmployeeHistoryPage />
                </ProtectedRoute>
              }
            />

            {/* Manager Routes (Phase 9) */}
            <Route
              path="/manager"
              element={
                <ProtectedRoute allowedRoles={['manager', 'admin']}>
                  <PlaceholderPage
                    title="Manager Dashboard"
                    subtitle="Team attendance overview and queues"
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/review"
              element={
                <ProtectedRoute allowedRoles={['manager', 'admin']}>
                  <PlaceholderPage
                    title="Selfie Review Queue"
                    subtitle="Review team member punch-in and punch-out selfies"
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/overtime"
              element={
                <ProtectedRoute allowedRoles={['manager', 'admin']}>
                  <PlaceholderPage
                    title="Overtime Review Queue"
                    subtitle="Review pending team overtime requests"
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/reports"
              element={
                <ProtectedRoute allowedRoles={['manager', 'admin']}>
                  <PlaceholderPage
                    title="Team Daily Reports"
                    subtitle="Export team attendance logs to XLSX and PDF"
                  />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes (Phase 9) */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <PlaceholderPage
                    title="Admin Dashboard"
                    subtitle="Company-wide attendance and user telemetry"
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <PlaceholderPage
                    title="User Management"
                    subtitle="Assign roles, assign managers, and manage account statuses"
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/attendance"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <PlaceholderPage
                    title="All Attendance"
                    subtitle="Search and filter company-wide shift records"
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/review"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <PlaceholderPage
                    title="System Review Queue"
                    subtitle="Review all pending selfies across the company"
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/overtime"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <PlaceholderPage
                    title="System Overtime Queue"
                    subtitle="Approve or reject company overtime requests"
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <PlaceholderPage
                    title="Reports & Exports"
                    subtitle="System-wide attendance exports and summaries"
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <PlaceholderPage
                    title="Geofence Settings"
                    subtitle="Configure office coordinates and geofence radius"
                  />
                </ProtectedRoute>
              }
            />

            {/* Notifications Route (Phase 10) */}
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <PlaceholderPage
                    title="Notifications"
                    subtitle="Realtime alerts, approvals, and reminders"
                  />
                </ProtectedRoute>
              }
            />

            {/* 404 Fallback */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" closeButton />
      </ErrorBoundary>
    </Provider>
  );
}

export default App;
