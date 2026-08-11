import React, { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, Settings, X, Clock, AlertCircle, CheckCircle, Timer, Coffee, Trash2 } from 'lucide-react';
import { notificationApi } from '../../services/api/notification';
import { Notification, NotificationType } from '@shared/types';
import { useTheme, useMenuNavigation } from "../../hooks";
import { useFocusTrap } from '../../hooks/common/useFocusTrap';
import { useEscapeKey } from '../../hooks/common/useEscapeKey';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { asyncConfirm } from '@/utils/asyncConfirm';
import { message } from '@/utils/messageHelper';
import { formatDate } from '@/utils/formatters';
import { EmptyState } from '../common/EmptyState';
import { SkeletonList } from '../common';
import { useNotificationsStore } from '../../store/useNotificationsStore';

const notificationIcons: Record<NotificationType, React.ReactNode> = {
  task_start: <Timer aria-hidden="true" className="text-primary-500" size={16} />,
  task_complete: <CheckCircle aria-hidden="true" className="text-green-500" size={16} />,
  time_slice_end: <Clock aria-hidden="true" className="text-orange-500" size={16} />,
  deadline: <AlertCircle aria-hidden="true" className="text-red-500" size={16} />,
  break_start: <Coffee aria-hidden="true" className="text-primary-500" size={16} />,
  break_end: <Coffee aria-hidden="true" className="text-primary-500" size={16} />,
  daily_summary: <CheckCircle aria-hidden="true" className="text-primary-500" size={16} />,
  system: <Bell aria-hidden="true" className="text-slate-500" size={16} />,
};

export const NotificationCenter: React.FC = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const mutedTypes = useNotificationsStore((s) => s.mutedNotificationTypes);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const panelRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen, restoreFocus: true });
  useEscapeKey(() => setIsOpen(false), isOpen);

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('common.timeAgo.justNow');
    if (diffMins < 60) return t('common.timeAgo.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('common.timeAgo.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('common.timeAgo.daysAgo', { count: diffDays });
    return formatDate(dateString, 'short');
  };

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await notificationApi.getNotifications({ limit: 10 });
      if (response.success) {
        setNotifications(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
      message.error(t('notifications.loadListFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await notificationApi.getUnreadCount();
      if (response.success) {
        setUnreadCount(response.count || 0);
      }
    } catch (error) {
      console.error('Failed to load unread count:', error);
      message.error(t('notifications.loadUnreadFailed'));
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();

    const unsubNotificationNew = frontendEventBus.subscribe("notification_new", () => {
      loadUnreadCount();
      loadNotifications();
    });
    const unsubSseNotificationNeeded = frontendEventBus.subscribe("sse_notification_needed", () => {
      loadUnreadCount();
      loadNotifications();
    });
    const unsubSseTaskCompleted = frontendEventBus.subscribe("sse_task_completed", () => {
      loadUnreadCount();
    });
    const unsubSseFocusSessionEnded = frontendEventBus.subscribe("sse_focus_session_ended", () => {
      loadUnreadCount();
    });

    return () => {
      unsubNotificationNew();
      unsubSseNotificationNeeded();
      unsubSseTaskCompleted();
      unsubSseFocusSessionEnded();
    };
  }, [loadNotifications, loadUnreadCount]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationApi.markAsRead(notificationId);
      setNotifications(notifications.map(n =>
        n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
      message.error(t('notifications.markReadFailed'));
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      message.error(t('notifications.markAllReadFailed'));
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
      message.error(t('notifications.deleteFailed'));
    }
  };

  const handleDeleteReadNotifications = async () => {
    const readIds = notifications.filter(n => n.read_at).map(n => n.id);
    if (readIds.length === 0) return;

    const confirmed = await asyncConfirm({
      title: t('common.confirm.deleteReadNotificationsTitle'),
      message: t('common.confirm.deleteReadNotificationsMessage', { count: readIds.length }),
      confirmText: t('notifications.center.delete'),
      cancelText: t('notifications.center.cancel'),
      isDangerous: true,
    });
    if (!confirmed) return;

    try {
      await Promise.all(readIds.map(id => notificationApi.deleteNotification(id)));
      setNotifications(notifications.filter(n => !n.read_at));
    } catch (error) {
      console.error('Failed to delete read notifications:', error);
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

  const visibleNotifications = mutedTypes.length > 0
    ? notifications.filter(n => !mutedTypes.includes(n.type))
    : notifications;
  const unreadNotifications = visibleNotifications.filter(n => !n.read_at);
  const readNotifications = visibleNotifications.filter(n => n.read_at);

  const notificationIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    visibleNotifications.forEach((n, i) => map.set(n.id, i));
    return map;
  }, [visibleNotifications]);

  const { activeIndex } = useMenuNavigation({
    itemCount: visibleNotifications.length,
    enabled: isOpen,
    onSelect: (index: number) => {
      const notification = visibleNotifications[index];
      if (notification) handleNotificationClick(notification);
    },
    onClose: () => setIsOpen(false),
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        aria-label={t('notifications.center.toggle')}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={`relative p-2 rounded-lg transition-colors ${
          isDark
            ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
            : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
        }`}
      >
        <Bell aria-hidden="true" size={20} />
        {unreadCount > 0 && (
          <span aria-live="polite" aria-label={t('notifications.unreadCountAria', { count: unreadCount })} className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
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
                <h3 id={titleId} className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {t('notifications.center.title')}
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 text-xs font-medium rounded-full">
                    {t('notifications.center.unreadCount', { count: unreadCount })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className={`p-1.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] touch-target flex items-center justify-center ${
                      isDark
                        ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
                        : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                    }`}
                    title={t('notifications.markAllRead')}
                    aria-label={t('notifications.markAllRead')}
                  >
                    <Check aria-hidden="true" size={16} />
                  </button>
                )}
                {readNotifications.length > 0 && (
                  <button
                    onClick={handleDeleteReadNotifications}
                    className={`p-1.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] touch-target flex items-center justify-center ${
                      isDark
                        ? 'hover:bg-red-900/30 text-slate-400 hover:text-red-400'
                        : 'hover:bg-red-50 text-gray-500 hover:text-red-500'
                    }`}
                    title={t('notifications.deleteRead')}
                    aria-label={t('notifications.deleteRead')}
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/settings#notifications');
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDark
                      ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                  }`}
                  title={t('notifications.settings.title')}
                  aria-label={t('notifications.settings.title')}
                >
                  <Settings aria-hidden="true" size={16} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[400px] overflow-y-auto" role="list">
              {loading ? (
                <SkeletonList items={5} hasAvatar />
              ) : visibleNotifications.length === 0 ? (
                <EmptyState
                  icon={<Bell aria-hidden="true" size={32} />}
                  title={t('notifications.empty')}
                  description={t('notifications.emptyHint')}
                />
              ) : (
                <>
                  {/* Unread notifications */}
                  {unreadNotifications.length > 0 && (
                    <div>
                      {unreadNotifications.map((notification) => (
                        <div key={notification.id} role="listitem">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => handleNotificationClick(notification)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleNotificationClick(notification);
                              }
                            }}
                            className={`px-4 py-3 cursor-pointer transition-colors border-l-2 border-primary-500 ${
                              notificationIndexMap.get(notification.id) === activeIndex
                                ? isDark
                                  ? 'bg-slate-700'
                                  : 'bg-primary-100'
                                : isDark
                                  ? 'bg-slate-700/50 hover:bg-slate-700'
                                  : 'bg-primary-50/50 hover:bg-primary-50'
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
                                aria-label={t('common.aria.close')}
                                className={`p-1 rounded transition-colors min-h-[44px] min-w-[44px] touch-target flex items-center justify-center ${
                                  isDark
                                    ? 'hover:bg-slate-600 text-slate-500 hover:text-slate-300'
                                    : 'hover:bg-gray-200 text-gray-400 hover:text-gray-600'
                                }`}
                              >
                                <X aria-hidden="true" size={14} />
                              </button>
                            </div>
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
                          {t('notifications.center.markAsRead')}
                        </div>
                      )}
                      {readNotifications.map((notification) => (
                        <div key={notification.id} role="listitem">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => handleNotificationClick(notification)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleNotificationClick(notification);
                              }
                            }}
                            className={`px-4 py-3 cursor-pointer transition-colors ${
                              notificationIndexMap.get(notification.id) === activeIndex
                                ? isDark
                                  ? 'bg-slate-700/50'
                                  : 'bg-gray-100'
                                : isDark
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
                                aria-label={t('common.aria.close')}
                                className={`p-1 rounded transition-colors min-h-[44px] min-w-[44px] touch-target flex items-center justify-center ${
                                  isDark
                                    ? 'hover:bg-slate-600 text-slate-600 hover:text-slate-400'
                                    : 'hover:bg-gray-200 text-gray-300 hover:text-gray-500'
                                }`}
                              >
                                <X aria-hidden="true" size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {visibleNotifications.length > 0 && (
              <div className={`px-4 py-2 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/notifications');
                  }}
                  className={`w-full text-center text-sm font-medium ${
                    isDark
                      ? 'text-primary-400 hover:text-primary-300'
                      : 'text-primary-600 hover:text-primary-700'
                  }`}
                >
                  {t('notifications.center.viewAll')}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
