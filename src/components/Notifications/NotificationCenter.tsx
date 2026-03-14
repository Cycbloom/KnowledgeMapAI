import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, Settings, X, Clock, AlertCircle, CheckCircle, Timer, Coffee } from 'lucide-react';
import { notificationApi } from '../../services/api/notification';
import { Notification, NotificationType } from '@shared/types';
import { useTheme } from "../../hooks";
import { useNavigate } from 'react-router-dom';

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  task_start: <Timer className="text-blue-500" size={16} />,
  task_complete: <CheckCircle className="text-green-500" size={16} />,
  time_slice_end: <Clock className="text-orange-500" size={16} />,
  deadline: <AlertCircle className="text-red-500" size={16} />,
  break_start: <Coffee className="text-purple-500" size={16} />,
  break_end: <Coffee className="text-purple-500" size={16} />,
  daily_summary: <CheckCircle className="text-cyan-500" size={16} />,
  system: <Bell className="text-slate-500" size={16} />,
};

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN');
};

export const NotificationCenter: React.FC = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();

    const interval = setInterval(() => {
      loadUnreadCount();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await notificationApi.getNotifications({ limit: 10 });
      if (response.success) {
        setNotifications(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await notificationApi.getUnreadCount();
      if (response.success) {
        setUnreadCount(response.count || 0);
      }
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationApi.markAsRead(notificationId);
      setNotifications(notifications.map(n =>
        n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationApi.deleteNotification(notificationId);
      setNotifications(notifications.filter(n => n.id !== notificationId));
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.read_at) {
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read_at) {
      await handleMarkAsRead(notification.id);
    }

    if (notification.data?.taskId) {
      navigate(`/scheduler/task/${notification.data.taskId}`);
    }

    setIsOpen(false);
  };

  const unreadNotifications = notifications.filter(n => !n.read_at);
  const readNotifications = notifications.filter(n => n.read_at);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors ${
          isDark
            ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
            : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
        }`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl shadow-xl border overflow-hidden z-50 ${
              isDark
                ? 'bg-slate-800 border-slate-700'
                : 'bg-white border-gray-200'
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${
              isDark ? 'border-slate-700' : 'border-gray-100'
            }`}>
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  通知
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full">
                    {unreadCount} 条未读
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isDark
                        ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
                        : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                    }`}
                    title="全部已读"
                  >
                    <Check size={16} />
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/settings?tab=notifications');
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDark
                      ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                  title="通知设置"
                >
                  <Settings size={16} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : notifications.length === 0 ? (
                <div className={`text-center py-10 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  <Bell size={32} className="mx-auto mb-2 opacity-50" />
                  <p>暂无通知</p>
                </div>
              ) : (
                <>
                  {/* Unread notifications */}
                  {unreadNotifications.length > 0 && (
                    <div>
                      {unreadNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`px-4 py-3 cursor-pointer transition-colors border-l-2 border-blue-500 ${
                            isDark
                              ? 'bg-slate-700/50 hover:bg-slate-700'
                              : 'bg-blue-50/50 hover:bg-blue-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {notificationIcons[notification.type]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {notification.title}
                              </p>
                              {notification.message && (
                                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                                  {notification.message}
                                </p>
                              )}
                              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                {formatTimeAgo(notification.created_at)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => handleDelete(notification.id, e)}
                              className={`p-1 rounded transition-colors ${
                                isDark
                                  ? 'hover:bg-slate-600 text-slate-500 hover:text-slate-300'
                                  : 'hover:bg-gray-200 text-gray-400 hover:text-gray-600'
                              }`}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Read notifications */}
                  {readNotifications.length > 0 && (
                    <div>
                      {unreadNotifications.length > 0 && (
                        <div className={`px-4 py-2 text-xs font-medium ${
                          isDark ? 'text-slate-500 bg-slate-800' : 'text-gray-400 bg-gray-50'
                        }`}>
                          已读
                        </div>
                      )}
                      {readNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`px-4 py-3 cursor-pointer transition-colors ${
                            isDark
                              ? 'hover:bg-slate-700/50'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5 opacity-50">
                              {notificationIcons[notification.type]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                                {notification.title}
                              </p>
                              {notification.message && (
                                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                                  {notification.message}
                                </p>
                              )}
                              <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-gray-300'}`}>
                                {formatTimeAgo(notification.created_at)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => handleDelete(notification.id, e)}
                              className={`p-1 rounded transition-colors ${
                                isDark
                                  ? 'hover:bg-slate-600 text-slate-600 hover:text-slate-400'
                                  : 'hover:bg-gray-200 text-gray-300 hover:text-gray-500'
                              }`}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className={`px-4 py-2 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/notifications');
                  }}
                  className={`w-full text-center text-sm font-medium ${
                    isDark
                      ? 'text-blue-400 hover:text-blue-300'
                      : 'text-blue-600 hover:text-blue-700'
                  }`}
                >
                  查看全部通知
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
