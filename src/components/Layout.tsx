import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useUser, useLogoutMutation, useTasks } from '../hooks/useQueries';
import { useMessageStore } from '../store/useMessageStore';
import { LogOut, LayoutDashboard, BookOpen, User, ChevronLeft, ChevronRight, Menu, X, ListChecks, BarChart } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { MessageBar } from './MessageBar';

export const Layout = () => {
  const { user, setUser, token } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { addMessage } = useMessageStore();
  
  // Use TanStack Query for user fetching
  // Only fetch if we have a token but no user (e.g. refresh)
  const { data: userData, isLoading: isUserLoading } = useUser(!!token && !user);
  const logoutMutation = useLogoutMutation();
  const { data: tasksData } = useTasks(!!token);
  const lastTaskStatusRef = useRef<Map<string, string>>(new Map());
  const hasInitializedTasksRef = useRef(false);

  // Sync Query result to Store
  useEffect(() => {
    if (userData && userData.user) {
      setUser(userData.user, token);
    } else if (userData && !userData.user && !isUserLoading) {
        // If fetch completed but no user, logout
        handleLogout();
    }
  }, [userData, isUserLoading, setUser, token]);

  useEffect(() => {
    if (!Array.isArray(tasksData)) return;

    if (!hasInitializedTasksRef.current) {
      hasInitializedTasksRef.current = true;
      lastTaskStatusRef.current = new Map(tasksData.map((t: any) => [t.id, t.status]));
      return;
    }

    const typeLabel = (type: string) => {
      if (type === 'generate_questions') return '自动生成题目';
      if (type === 'expand_graph') return '自动扩展图谱';
      return type;
    };

    const updated = new Map(lastTaskStatusRef.current);

    for (const t of tasksData as any[]) {
      const prev = lastTaskStatusRef.current.get(t.id);
      if (prev && prev !== t.status) {
        if (t.status === 'completed') {
          addMessage({
            type: 'success',
            content: `任务完成：${typeLabel(t.type)}`,
            duration: 8000,
            action: { label: '查看', onClick: () => navigate('/tasks') }
          });
        }
        if (t.status === 'failed') {
          addMessage({
            type: 'error',
            content: `任务失败：${typeLabel(t.type)}${t.error ? `（${t.error}）` : ''}`,
            duration: 10000,
            action: { label: '查看', onClick: () => navigate('/tasks') }
          });
        }
      }
      updated.set(t.id, t.status);
    }

    lastTaskStatusRef.current = updated;
  }, [tasksData, addMessage, navigate]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (e) {
      console.error(e);
    }
    setUser(null, null);
    navigate('/login');
  };

  // Initial loading state: if we need to fetch user, show loading
  if ((!!token && !user && isUserLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">加载中...</div>
      </div>
    );
  }

  // Sidebar link helper
  const SidebarLink = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
    <Link 
      to={to} 
      className={`flex items-center ${isCollapsed && !isMobileMenuOpen ? 'justify-center' : 'space-x-2'} p-2 hover:bg-slate-800 rounded transition-colors`} 
      title={label}
    >
      <Icon size={20} />
      {(!isCollapsed || isMobileMenuOpen) && <span>{label}</span>}
    </Link>
  );

  return (
    <div className="flex h-screen bg-gray-50 flex-col">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center z-20 shadow-md">
        <span className="font-bold text-lg">知识图谱</span>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 md:hidden" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-40 bg-slate-900 text-white flex flex-col transition-all duration-300
          transform md:relative md:translate-x-0
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          w-64 ${isCollapsed ? 'md:w-20' : 'md:w-64'}
        `}>
          {/* Sidebar Header (Desktop) */}
          <div className="hidden md:flex p-4 text-xl font-bold border-b border-slate-700 items-center justify-between h-16">
            {!isCollapsed && <span className="truncate">知识图谱</span>}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)} 
              className={`p-1 hover:bg-slate-800 rounded ${isCollapsed ? 'mx-auto' : ''}`}
            >
              {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>

          {/* Sidebar Header (Mobile) - just for spacing or logo if needed, but we have external header */}
          <div className="md:hidden p-4 text-xl font-bold border-b border-slate-700 flex items-center h-16">
            <span>知识图谱</span>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <SidebarLink to="/dashboard" icon={LayoutDashboard} label="仪表盘" />
            <SidebarLink to="/study" icon={BookOpen} label="学习模式" />
            <SidebarLink to="/statistics" icon={BarChart} label="统计分析" />
            <SidebarLink to="/tasks" icon={ListChecks} label="任务中心" />
            <SidebarLink to="/profile" icon={User} label="个人资料" />
          </nav>

          <div className="p-4 border-t border-slate-700">
            <button 
              onClick={handleLogout} 
              className={`flex items-center ${isCollapsed && !isMobileMenuOpen ? 'justify-center' : 'space-x-2'} text-gray-400 hover:text-white w-full p-2 hover:bg-slate-800 rounded transition-colors`} 
              title="退出登录"
            >
              <LogOut size={20} />
              {(!isCollapsed || isMobileMenuOpen) && <span>退出登录</span>}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col w-full relative">
          <div className="flex-1 overflow-hidden">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
          <MessageBar />
        </div>
      </div>
    </div>
  );
};
