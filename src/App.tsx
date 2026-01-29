import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { GraphEditor } from './pages/GraphEditor';
import { Study } from './pages/Study';
import { useStore } from './store/useStore';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, token } = useStore();
  // Simple check. Real app should verify token expiry or fetch user on mount.
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function App() {
  return (
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
  );
}

export default App;
