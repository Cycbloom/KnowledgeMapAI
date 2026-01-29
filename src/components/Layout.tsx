import React, { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { LogOut, LayoutDashboard, Database, BookOpen, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../services/api';

export const Layout = () => {
  const { user, setUser, token } = useStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!user && !!token);
  const [isCollapsed, setIsCollapsed] = useState(false);

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
        <div className="text-xl text-gray-600">加载中...</div>
      </div>
    );
  }

  // If we have no user and no token, we shouldn't be here (ProtectedRoute handles it),
  // but if we do end up here, just render Outlet or redirect.
  // We'll render the layout structure assuming if we are here, we are authenticated or public routes are allowed.
  // But ProtectedRoute wraps this, so we are safe.

  return (
    <div className="flex h-screen bg-gray-50">
      <div className={`${isCollapsed ? 'w-20' : 'w-64'} flex-shrink-0 bg-slate-900 text-white flex flex-col transition-all duration-300`}>
        <div className="p-4 text-xl font-bold border-b border-slate-700 flex items-center justify-between">
          {!isCollapsed && <span className="truncate">知识图谱</span>}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className={`p-1 hover:bg-slate-800 rounded ${isCollapsed ? 'mx-auto' : ''}`}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/dashboard" className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2'} p-2 hover:bg-slate-800 rounded`} title="仪表盘">
            <LayoutDashboard size={20} />
            {!isCollapsed && <span>仪表盘</span>}
          </Link>
          <Link to="/study" className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2'} p-2 hover:bg-slate-800 rounded`} title="学习模式">
            <BookOpen size={20} />
            {!isCollapsed && <span>学习模式</span>}
          </Link>
          <Link to="/profile" className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2'} p-2 hover:bg-slate-800 rounded`} title="个人资料">
            <User size={20} />
            {!isCollapsed && <span>个人资料</span>}
          </Link>
        </nav>
        <div className="p-4 border-t border-slate-700">
          <button onClick={handleLogout} className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2'} text-gray-400 hover:text-white w-full`} title="退出登录">
            <LogOut size={20} />
            {!isCollapsed && <span>退出登录</span>}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};
