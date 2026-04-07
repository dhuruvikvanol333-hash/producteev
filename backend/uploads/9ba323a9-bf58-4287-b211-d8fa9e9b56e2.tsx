/**
 * Day 37: Lazy-loaded page components using React.lazy + Suspense
 * Splits each view into its own JS chunk → smaller initial bundle
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router';

import { MainLayout } from './components/layout/MainLayout';

import { ProtectedRoute } from './routes/ProtectedRoute';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { Loading } from './components/ui/Loading';

// ─── Eagerly loaded (critical path) ─────────────────────────────────────────
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';

// ─── Lazy loaded (code-split) ────────────────────────────────────────────────
const TaskDetailPage = lazy(() => import('./pages/tasks/TaskDetailPage').then(m => ({ default: m.TaskDetailPage })));
const AssignedToMePage = lazy(() => import('./pages/tasks/AssignedToMePage').then(m => ({ default: m.AssignedToMePage })));
const TeamAssignedPage = lazy(() => import('./pages/tasks/TeamAssignedPage').then(m => ({ default: m.TeamAssignedPage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const PeoplePage = lazy(() => import('./pages/people/PeoplePage').then(m => ({ default: m.PeoplePage })));
const ListPage = lazy(() => import('./pages/lists/ListPage').then(m => ({ default: m.ListPage })));
const ListSettingsPage = lazy(() => import('./pages/lists/ListSettingsPage').then(m => ({ default: m.ListSettingsPage })));
const CreateWorkspacePage = lazy(() => import('./pages/onboarding/CreateWorkspacePage').then(m => ({ default: m.CreateWorkspacePage })));

const InboxPage = lazy(() => import('./pages/inbox/InboxPage').then(m => ({ default: m.InboxPage })));
const FavoritesPage = lazy(() => import('./pages/tasks/FavoritesPage').then(m => ({ default: m.FavoritesPage })));

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loading size="lg" text="Loading page…" />
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const background = location.state?.backgroundLocation;

  return (
    <>
      <Routes location={background || location}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/onboarding/workspace" element={
              <>
                <DashboardPage />
                <Suspense fallback={null}><CreateWorkspacePage /></Suspense>
              </>
            } />
            <Route path="/inbox" element={
              <Suspense fallback={<PageFallback />}><InboxPage /></Suspense>
            } />

            <Route path="/tasks/assigned" element={
              <Suspense fallback={<PageFallback />}><AssignedToMePage /></Suspense>
            } />
            <Route path="/tasks/team" element={
              <Suspense fallback={<PageFallback />}><TeamAssignedPage /></Suspense>
            } />
            <Route path="/tasks/favorites" element={
              <Suspense fallback={<PageFallback />}><FavoritesPage /></Suspense>
            } />
            {/* Task Detail (Full Page - if no background) */}
            <Route path="/tasks/:id" element={
              <Suspense fallback={<PageFallback />}><TaskDetailPage /></Suspense>
            } />
            <Route path="/lists/:id" element={
              <Suspense fallback={<PageFallback />}><ListPage /></Suspense>
            } />
            <Route path="/lists/:id/settings" element={
              <Suspense fallback={<PageFallback />}><ListSettingsPage /></Suspense>
            } />
            <Route path="/settings" element={
              <Suspense fallback={<PageFallback />}><SettingsPage /></Suspense>
            } />
            <Route path="/people" element={
              <Suspense fallback={<PageFallback />}><PeoplePage /></Suspense>
            } />
          </Route>
        </Route>
      </Routes>

      {/* Modal Routes */}
      {background && (
        <Routes>
          <Route
            path="/tasks/:id"
            element={
              <Suspense fallback={null}>
                <TaskDetailPage isModal={true} />
              </Suspense>
            }
          />
        </Routes>
      )}
    </>
  );
}

function App() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <OfflineBanner />
      </ErrorBoundary>
    </ToastProvider>
  );
}


export default App;
