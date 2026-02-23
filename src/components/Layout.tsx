import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useUser, useLogoutMutation, useTasks } from '../hooks/useQueries';
import { useTaskEvents } from '../hooks/useTaskEvents';
import { useMessageStore } from '../store/useMessageStore';
import { LogOut, BookOpen, User, ChevronLeft, ChevronRight, Menu, X, ListChecks, HelpCircle, GraduationCap, Trash2, Sparkles, Trophy, Network, BarChart3, Sun, Moon } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { MessageBar } from './MessageBar';
import { HelpModal } from './HelpModal';
import { SSEStatusIndicator } from './SSEStatusIndicator';
import { OfflineIndicator } from './OfflineIndicator';
import { FocusTimer } from './FocusTimer';
import { Breadcrumb } from './Breadcrumb';
import { HeaderGreeting } from './HeaderGreeting';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';

export const Layout = () => {
  const { user, setUser, token } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { addMessage } = useMessageStore();
  
  const isFullScreenPage = location.pathname.startsWith('/graph/') || location.pathname === '/learning';
  
  // Use TanStack Query for user fetching
  // Only fetch if we have a token but no user (e.g. refresh)
  const { data: userData, isLoading: isUserLoading } = useUser(!!token && !user);
  const logoutMutation = useLogoutMutation();
  const { data: tasksData } = useTasks(!!token);
  useTaskEvents(); // Initialize SSE for task updates
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

  // Daily Check-in
  useEffect(() => {
    if (user?.id) {
      const today = new Date().toISOString().split('T')[0];
      const lastCheckIn = localStorage.getItem(`lastCheckIn_${user.id}`);
      
      if (lastCheckIn !== today) {
        api.achievements.checkIn().then(() => {
          localStorage.setItem(`lastCheckIn_${user.id}`, today);
        }).catch(console.error);
      }
    }
  }, [user?.id]);

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
    <div className={`flex h-screen flex-col ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-gray-50 text-gray-900'}`}>
      
      {/* Mobile Header */}
      <div className={`md:hidden p-4 flex justify-between items-center z-20 shadow-md ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-900 text-white'}`}>
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
        {!isFullScreenPage && (
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
                className="p-1 hover:bg-slate-800 rounded transition-colors"
              >
                {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              <SidebarLink to="/" icon={BookOpen} label="我的图谱" />
              <SidebarLink to="/graph-map" icon={Network} label="图谱地图" />
              <SidebarLink to="/study" icon={GraduationCap} label="学习中心" />
              <SidebarLink to="/learning-stats" icon={BarChart3} label="学习统计" />
              <SidebarLink to="/achievements" icon={Trophy} label="成就系统" />
              <SidebarLink to="/templates" icon={Sparkles} label="模板管理" />
              <SidebarLink to="/tasks" icon={ListChecks} label="任务中心" />
              <SidebarLink to="/profile" icon={User} label="个人设置" />
              <SidebarLink to="/trash" icon={Trash2} label="回收站" />
            </nav>

            {/* Sidebar Footer */}
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
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col w-full relative">
          
          {/* Top Header */}
          {!isFullScreenPage && (
            <header className={`h-12 px-6 flex items-center justify-between shrink-0 z-10 shadow-sm transition-colors border-b relative ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'
            }`}>
              {/* Left: Breadcrumb */}
              <div className="flex-shrink-0">
                <Breadcrumb />
              </div>
              
              {/* Center: Greeting & Stats - 绝对定位居中 */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <HeaderGreeting />
              </div>
              
              {/* Right: Status & User */}
              <div className="flex items-center gap-4 flex-shrink-0">
                 <SSEStatusIndicator />
                 <button 
                   onClick={toggleTheme}
                   className={`p-1.5 rounded-full transition-colors ${
                     isDark ? 'text-slate-400 hover:text-yellow-400 hover:bg-slate-800' : 'text-gray-500 hover:text-yellow-600 hover:bg-yellow-50'
                   }`}
                   title={isDark ? '切换到浅色模式' : '切换到深色模式'}
                 >
                   {isDark ? <Sun size={18} /> : <Moon size={18} />}
                 </button>
                 <button 
                   onClick={() => setIsHelpOpen(true)}
                   className={`p-1.5 rounded-full transition-colors ${
                     isDark ? 'text-slate-400 hover:text-blue-400 hover:bg-slate-800' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                   }`}
                   title="操作指南"
                 >
                   <HelpCircle size={18} />
                 </button>
                 {user && (
                   <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border transition-colors ${
                     isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-100'
                   }`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isDark ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
                      }`}>
                        {user.email?.charAt(0).toUpperCase()}
                      </div>
                      <span className={`text-xs font-medium max-w-[80px] truncate ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                        {(user.user_metadata as any)?.name || user.email?.split('@')[0]}
                      </span>
                   </div>
                 )}
              </div>
            </header>
          )}

          <div className="flex-1 overflow-hidden relative">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
          <MessageBar />
          <OfflineIndicator />
          <FocusTimer />
          <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
        </div>
      </div>
    </div>
  );
};
