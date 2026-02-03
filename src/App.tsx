import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useStore } from './store/useStore';
import { LoadingBar } from './components/LoadingBar';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy Load Pages
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Register = lazy(() => import('./pages/Register').then(module => ({ default: module.Register })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const GraphEditor = lazy(() => import('./pages/GraphEditor').then(module => ({ default: module.GraphEditor })));
const Study = lazy(() => import('./pages/Study').then(module => ({ default: module.Study })));
const LearningMode = lazy(() => import('./pages/LearningMode').then(module => ({ default: module.LearningMode })));
const Statistics = lazy(() => import('./pages/Statistics').then(module => ({ default: module.Statistics })));
const Tasks = lazy(() => import('./pages/Tasks').then(module => ({ default: module.Tasks })));
const Profile = lazy(() => import('./pages/Profile').then(module => ({ default: module.Profile })));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, token } = useStore();
  // Simple check. Real app should verify token expiry or fetch user on mount.
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <ErrorBoundary>
      <LoadingBar />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Navigate to="/" replace />} />
            <Route path="graphs" element={<Navigate to="/" replace />} />
            <Route path="graph/:id" element={<GraphEditor />} />
            <Route path="study" element={<Study />} />
            <Route path="learning" element={<LearningMode />} />
            <Route path="statistics" element={<Statistics />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
