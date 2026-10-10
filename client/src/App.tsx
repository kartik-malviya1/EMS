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

// Manager Pages (Phase 9)
import { ManagerDashboardPage } from './pages/manager/ManagerDashboardPage';
import { ManagerTeamAttendancePage } from './pages/manager/ManagerTeamAttendancePage';
import { ManagerReviewPage } from './pages/manager/ManagerReviewPage';
import { ManagerOvertimePage } from './pages/manager/ManagerOvertimePage';
import { ManagerReportsPage } from './pages/manager/ManagerReportsPage';

// Admin Pages (Phase 9)
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminAttendancePage } from './pages/admin/AdminAttendancePage';
import { AdminReviewPage } from './pages/admin/AdminReviewPage';
import { AdminOvertimePage } from './pages/admin/AdminOvertimePage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';

// Notifications Page (Phase 10)
import { NotificationsPage } from './pages/notifications/NotificationsPage';

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
                <ProtectedRoute allowedRoles={['employee', 'manager']}>
                  <EmployeeDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/history"
              element={
                <ProtectedRoute allowedRoles={['employee', 'manager']}>
                  <EmployeeHistoryPage />
                </ProtectedRoute>
              }
            />

            {/* Manager Routes (Phase 9) */}
            <Route
              path="/manager"
              element={
                <ProtectedRoute allowedRoles={['manager']}>
                  <ManagerDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/attendance"
              element={
                <ProtectedRoute allowedRoles={['manager']}>
                  <ManagerTeamAttendancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/review"
              element={
                <ProtectedRoute allowedRoles={['manager']}>
                  <ManagerReviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/overtime"
              element={
                <ProtectedRoute allowedRoles={['manager']}>
                  <ManagerOvertimePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/reports"
              element={
                <ProtectedRoute allowedRoles={['manager']}>
                  <ManagerReportsPage />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes (Phase 9) */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/attendance"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminAttendancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/review"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminReviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/overtime"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminOvertimePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminSettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Notifications Route */}
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
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
