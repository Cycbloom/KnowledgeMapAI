import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, Coffee, Timer, Zap, X, Save,
  RefreshCw
} from 'lucide-react';
import { schedulerApi, TaskSettings } from '../../services/api/scheduler';

interface PomodoroSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (settings: TaskSettings) => void;
}

export const PomodoroSettings: React.FC<PomodoroSettingsProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [settings, setSettings] = useState<TaskSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [focusDuration, setFocusDuration] = useState(25);
  const [shortBreakDuration, setShortBreakDuration] = useState(5);
  const [longBreakDuration, setLongBreakDuration] = useState(15);
  const [pomodorosUntilLongBreak, setPomodorosUntilLongBreak] = useState(4);
  const [autoStartPomodoro, setAutoStartPomodoro] = useState(false);
  const [autoStartBreak, setAutoStartBreak] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationEnabled, setNotificationEnabled] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await schedulerApi.getSettings();
      setSettings(data);
      setFocusDuration(data.q0_time_slice);
      setShortBreakDuration(data.break_duration);
      setSoundEnabled(data.sound_enabled);
      setNotificationEnabled(data.notification_enabled);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await schedulerApi.updateSettings({
        q0_time_slice: focusDuration,
        q1_time_slice: focusDuration * 2,
        q2_time_slice: focusDuration * 4,
        break_duration: shortBreakDuration,
        sound_enabled: soundEnabled,
        notification_enabled: notificationEnabled,
      });
      setSettings(updated);
      onSave?.(updated);
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const DurationSlider: React.FC<{
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    icon?: React.ReactNode;
    color?: string;
  }> = ({ label, value, onChange, min, max, step = 1, unit = '分钟', icon, color = 'cyan' }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          {icon}
          {label}
        </label>
        <span className={`text-lg font-bold text-${color}-500`}>
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-2 rounded-full appearance-none cursor-pointer
          bg-slate-200 dark:bg-slate-700
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-${color}-500
          [&::-webkit-slider-thumb]:shadow-lg
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:transition-transform
          [&::-webkit-slider-thumb]:hover:scale-110
        `}
      />
      <div className="flex justify-between text-xs text-slate-400">
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Timer size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">番茄钟设置</h2>
                    <p className="text-sm text-white/80">自定义你的专注节奏</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-12 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
              </div>
            ) : (
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <DurationSlider
                    label="专注时长"
                    value={focusDuration}
                    onChange={setFocusDuration}
                    min={5}
                    max={60}
                    step={5}
                    icon={<Clock size={16} className="text-cyan-500" />}
                    color="cyan"
                  />

                  <DurationSlider
                    label="短休息时长"
                    value={shortBreakDuration}
                    onChange={setShortBreakDuration}
                    min={1}
                    max={15}
                    step={1}
                    icon={<Coffee size={16} className="text-emerald-500" />}
                    color="emerald"
                  />

                  <DurationSlider
                    label="长休息时长"
                    value={longBreakDuration}
                    onChange={setLongBreakDuration}
                    min={10}
                    max={30}
                    step={5}
                    icon={<Coffee size={16} className="text-purple-500" />}
                    color="purple"
                  />

                  <DurationSlider
                    label="长休息间隔"
                    value={pomodorosUntilLongBreak}
                    onChange={setPomodorosUntilLongBreak}
                    min={2}
                    max={6}
                    step={1}
                    unit="个番茄钟"
                    icon={<RefreshCw size={16} className="text-amber-500" />}
                    color="amber"
                  />
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <Zap size={16} className="text-amber-500" />
                    自动化选项
                  </h3>

                  <div className="space-y-2">
                    <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        自动开始下一个番茄钟
                      </span>
                      <input
                        type="checkbox"
                        checked={autoStartPomodoro}
                        onChange={(e) => setAutoStartPomodoro(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        自动开始休息
                      </span>
                      <input
                        type="checkbox"
                        checked={autoStartBreak}
                        onChange={(e) => setAutoStartBreak(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        声音提示
                      </span>
                      <input
                        type="checkbox"
                        checked={soundEnabled}
                        onChange={(e) => setSoundEnabled(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        浏览器通知
                      </span>
                      <input
                        type="checkbox"
                        checked={notificationEnabled}
                        onChange={(e) => setNotificationEnabled(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <motion.button
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    取消
                  </motion.button>
                  <motion.button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Save size={18} />
                    {saving ? '保存中...' : '保存设置'}
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
