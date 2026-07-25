import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Volume2,
  VolumeX,
  Clock,
  CheckCircle,
  Timer,
  AlertTriangle,
  Coffee,
  FileText,
  Moon,
  Save,
  RefreshCw,
} from 'lucide-react';
import { notificationApi } from '../../services/api/notification';
import { NotificationSettings } from '@shared/types';
import { message } from "../../utils/messageHelper";
import { useTheme } from "../../hooks";
import { Skeleton } from '../common';
import { useTranslation } from 'react-i18next';

export const NotificationSettingsPanel: React.FC = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await notificationApi.getSettings();
      if (response.success) {
        setSettings(response.data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      await notificationApi.updateSettings(settings);
      message.success(t('notifications.settings.savedSuccess'));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('notifications.settings.saveFailed');
      message.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  const toggleDeadlineReminder = (minutes: number) => {
    if (!settings) return;
    const current = settings.deadline_reminder_minutes || [];
    const updated = current.includes(minutes)
      ? current.filter((m) => m !== minutes)
      : [...current, minutes].sort((a, b) => a - b);
    updateSetting('deadline_reminder_minutes', updated);
  };

  if (loading) {
    return (
      <div className="space-y-6 py-6">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-slate-500">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton variant="circular" width={24} height={24} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className={`text-center py-10 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
        <p>{t('notifications.settings.loadFailed')}</p>
        <button
          onClick={loadSettings}
          className="mt-2 text-primary-500 hover:text-primary-600"
        >
          {t('notifications.settings.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Basic Settings */}
      <div className={`p-6 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {t('notifications.settings.basicSettings')}
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className={isDark ? 'text-slate-400' : 'text-gray-500'} size={20} />
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {t('notifications.settings.browserNotifications.title')}
                </p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {t('notifications.settings.browserNotifications.desc')}
                </p>
              </div>
            </div>
            <button
              onClick={() => updateSetting('browser_enabled', !settings.browser_enabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.browser_enabled ? 'bg-primary-600' : isDark ? 'bg-slate-600' : 'bg-gray-300'
              }`}
            >
              <motion.div
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                animate={{ left: settings.browser_enabled ? '28px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.sound_enabled ? (
                <Volume2 className={isDark ? 'text-slate-400' : 'text-gray-500'} size={20} />
              ) : (
                <VolumeX className={isDark ? 'text-slate-500' : 'text-gray-400'} size={20} />
              )}
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {t('notifications.settings.soundReminder.title')}
                </p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {t('notifications.settings.soundReminder.desc')}
                </p>
              </div>
            </div>
            <button
              onClick={() => updateSetting('sound_enabled', !settings.sound_enabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.sound_enabled ? 'bg-primary-600' : isDark ? 'bg-slate-600' : 'bg-gray-300'
              }`}
            >
              <motion.div
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                animate={{ left: settings.sound_enabled ? '28px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          {settings.sound_enabled && (
            <div className="ml-8">
              <p className={`text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                {t('notifications.settings.soundReminder.volume', { volume: settings.sound_volume })}
              </p>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.sound_volume}
                onChange={(e) => updateSetting('sound_volume', parseInt(e.target.value))}
                className="w-full max-w-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Notification Types */}
      <div className={`p-6 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {t('notifications.settings.notificationTypes')}
        </h3>
        <div className="space-y-3">
          {[
            { key: 'task_start_enabled', icon: Timer, labelKey: 'notifications.settings.type.taskStart', descKey: 'notifications.settings.type.taskStartDesc' },
            { key: 'task_complete_enabled', icon: CheckCircle, labelKey: 'notifications.settings.type.taskComplete', descKey: 'notifications.settings.type.taskCompleteDesc' },
            { key: 'time_slice_end_enabled', icon: Clock, labelKey: 'notifications.settings.type.timeSliceEnd', descKey: 'notifications.settings.type.timeSliceEndDesc' },
            { key: 'deadline_enabled', icon: AlertTriangle, labelKey: 'notifications.settings.type.deadline', descKey: 'notifications.settings.type.deadlineDesc' },
            { key: 'break_enabled', icon: Coffee, labelKey: 'notifications.settings.type.break', descKey: 'notifications.settings.type.breakDesc' },
            { key: 'daily_summary_enabled', icon: FileText, labelKey: 'notifications.settings.type.dailySummary', descKey: 'notifications.settings.type.dailySummaryDesc' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <item.icon className={isDark ? 'text-slate-400' : 'text-gray-500'} size={18} />
                <div>
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {t(item.labelKey, { defaultValue: '' })}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {t(item.descKey, { defaultValue: '' })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => updateSetting(item.key as keyof NotificationSettings, !settings[item.key as keyof NotificationSettings])}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  settings[item.key as keyof NotificationSettings] ? 'bg-primary-600' : isDark ? 'bg-slate-600' : 'bg-gray-300'
                }`}
              >
                <motion.div
                  className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
                  animate={{ left: settings[item.key as keyof NotificationSettings] ? '22px' : '2px' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Deadline Reminder Time */}
      {settings.deadline_enabled && (
        <div className={`p-6 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
          <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('notifications.settings.deadlineReminderTime.title')}
          </h3>
          <p className={`text-sm mb-3 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            {t('notifications.settings.deadlineReminderTime.desc')}
          </p>
          <div className="flex flex-wrap gap-2">
            {[15, 30, 60, 120, 1440].map((minutes) => (
              <button
                key={minutes}
                onClick={() => toggleDeadlineReminder(minutes)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  settings.deadline_reminder_minutes?.includes(minutes)
                    ? 'bg-primary-600 text-white'
                    : isDark
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {minutes < 60
                  ? t('notifications.settings.duration.minute', { count: minutes })
                  : minutes < 1440
                    ? t('notifications.settings.duration.hour', { count: minutes / 60 })
                    : t('notifications.settings.duration.day', { count: 1 })}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Do Not Disturb */}
      <div className={`p-6 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {t('notifications.settings.doNotDisturb.title')}
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon className={isDark ? 'text-slate-400' : 'text-gray-500'} size={20} />
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {t('notifications.settings.doNotDisturb.enable')}
                </p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {t('notifications.settings.doNotDisturb.desc')}
                </p>
              </div>
            </div>
            <button
              onClick={() => updateSetting('do_not_disturb_enabled', !settings.do_not_disturb_enabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.do_not_disturb_enabled ? 'bg-primary-600' : isDark ? 'bg-slate-600' : 'bg-gray-300'
              }`}
            >
              <motion.div
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                animate={{ left: settings.do_not_disturb_enabled ? '28px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          {settings.do_not_disturb_enabled && (
            <div className="flex items-center gap-4 ml-8">
              <div>
                <label className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {t('notifications.settings.doNotDisturb.startTime')}
                </label>
                <input
                  type="time"
                  value={settings.do_not_disturb_start || '22:00'}
                  onChange={(e) => updateSetting('do_not_disturb_start', e.target.value)}
                  className={`ml-2 px-3 py-1.5 rounded-lg border ${
                    isDark
                      ? 'bg-slate-700 border-slate-600 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                />
              </div>
              <div>
                <label className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {t('notifications.settings.doNotDisturb.endTime')}
                </label>
                <input
                  type="time"
                  value={settings.do_not_disturb_end || '08:00'}
                  onChange={(e) => updateSetting('do_not_disturb_end', e.target.value)}
                  className={`ml-2 px-3 py-1.5 rounded-lg border ${
                    isDark
                      ? 'bg-slate-700 border-slate-600 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={loadSettings}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
            isDark
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <RefreshCw size={16} />
          {t('notifications.settings.reset')}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <Save size={16} />
          )}
          {t('notifications.settings.save')}
        </button>
      </div>
    </div>
  );
};
