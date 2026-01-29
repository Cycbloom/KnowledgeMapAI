import React, { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { LogOut, LayoutDashboard, Database, BookOpen, User } from 'lucide-react';
import { api } from '../services/api';

export const Layout = () => {
  const { user, setUser, token } = useStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!user && !!token);

  useEffect(() => {
    const fetchUser = async () => {
      if (!user && token) {
        try {
          const data = await api.auth.getUser();
          if (data && data.user) {
            setUser(data.user, token);
          } else {
            throw new Error('User not found');
          }
        } catch (error) {
          console.error('Failed to fetch user:', error);
          await handleLogout();
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchUser();
  }, [user, token, setUser]);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch (e) {
      console.error(e);
    }
    setUser(null, null);
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  // If we have no user and no token, we shouldn't be here (ProtectedRoute handles it),
  // but if we do end up here, just render Outlet or redirect.
  // We'll render the layout structure assuming if we are here, we are authenticated or public routes are allowed.
  // But ProtectedRoute wraps this, so we are safe.

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-slate-700">KnowledgeMap</div>
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/dashboard" className="flex items-center space-x-2 p-2 hover:bg-slate-800 rounded">
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>
          <Link to="/study" className="flex items-center space-x-2 p-2 hover:bg-slate-800 rounded">
            <BookOpen size={20} />
            <span>Study</span>
          </Link>
          <Link to="/profile" className="flex items-center space-x-2 p-2 hover:bg-slate-800 rounded">
            <User size={20} />
            <span>Profile</span>
          </Link>
        </nav>
        <div className="p-4 border-t border-slate-700">
          <button onClick={handleLogout} className="flex items-center space-x-2 text-gray-400 hover:text-white">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};
