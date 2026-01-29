import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { useStore } from './store/useStore';

// Lazy Load Pages
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Register = lazy(() => import('./pages/Register').then(module => ({ default: module.Register })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const GraphEditor = lazy(() => import('./pages/GraphEditor').then(module => ({ default: module.GraphEditor })));
const Study = lazy(() => import('./pages/Study').then(module => ({ default: module.Study })));

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
    <>
      <Toaster position="top-center" />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="graph/:id" element={<GraphEditor />} />
            <Route path="study" element={<Study />} />
            <Route path="profile" element={<div className="p-8">Profile (Coming Soon)</div>} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
