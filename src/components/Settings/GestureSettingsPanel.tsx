import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Hand,
  ZoomIn,
  RotateCw,
  Zap,
  ArrowLeftRight,
  Compass,
  Save,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import { useTheme } from '../../hooks';

export interface GestureSettings {
  sensitivity: number;
  pinchZoomEnabled: boolean;
  pinchRotateEnabled: boolean;
  flingInertiaEnabled: boolean;
  edgeSwipeBackEnabled: boolean;
  rotationSnapAngle: 15 | 30 | 45 | 90;
}

const DEFAULT_SETTINGS: GestureSettings = {
  sensitivity: 1.0,
  pinchZoomEnabled: true,
  pinchRotateEnabled: true,
  flingInertiaEnabled: true,
  edgeSwipeBackEnabled: true,
  rotationSnapAngle: 45,
};

const STORAGE_KEY = 'gesture-settings';

const loadSettings = (): GestureSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load gesture settings:', error);
  }
  return DEFAULT_SETTINGS;
};

const saveSettings = (settings: GestureSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save gesture settings:', error);
  }
};

export const GestureSettingsPanel: React.FC = () => {
  const { isDark } = useTheme();
  const [settings, setSettings] = useState<GestureSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<GestureSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    setOriginalSettings(loaded);
    setLoading(false);
  }, []);

  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  const updateSetting = <K extends keyof GestureSettings>(key: K, value: GestureSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      saveSettings(settings);
      setOriginalSettings(settings);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const handleReload = () => {
    const loaded = loadSettings();
    setSettings(loaded);
    setOriginalSettings(loaded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          基础设置
        </h3>
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Sliders className={isDark ? 'text-slate-400' : 'text-gray-500'} size={20} />
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  手势灵敏度
                </p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  调整手势响应的灵敏度
                </p>
              </div>
            </div>
            <div className="ml-8">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>0.1</span>
                <span className={`text-sm font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  {settings.sensitivity.toFixed(1)}
                </span>
                <span className={`text-sm ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>2.0</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={settings.sensitivity}
                onChange={(e) => updateSetting('sensitivity', parseFloat(e.target.value))}
                className="w-full max-w-md h-2 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>
        </div>
      </div>

      <div className={`p-6 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          手势功能
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ZoomIn className={isDark ? 'text-slate-400' : 'text-gray-500'} size={20} />
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  双指缩放
                </p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  使用双指捏合手势缩放内容
                </p>
              </div>
            </div>
            <button
              onClick={() => updateSetting('pinchZoomEnabled', !settings.pinchZoomEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.pinchZoomEnabled ? 'bg-blue-600' : isDark ? 'bg-slate-600' : 'bg-gray-300'
              }`}
            >
              <motion.div
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                animate={{ left: settings.pinchZoomEnabled ? '28px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RotateCw className={isDark ? 'text-slate-400' : 'text-gray-500'} size={20} />
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  双指旋转
                </p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  使用双指旋转手势旋转内容
                </p>
              </div>
            </div>
            <button
              onClick={() => updateSetting('pinchRotateEnabled', !settings.pinchRotateEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.pinchRotateEnabled ? 'bg-blue-600' : isDark ? 'bg-slate-600' : 'bg-gray-300'
              }`}
            >
              <motion.div
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                animate={{ left: settings.pinchRotateEnabled ? '28px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className={isDark ? 'text-slate-400' : 'text-gray-500'} size={20} />
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  快速滑动惯性
                </p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  快速滑动后内容继续滑动并逐渐减速
                </p>
              </div>
            </div>
            <button
              onClick={() => updateSetting('flingInertiaEnabled', !settings.flingInertiaEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.flingInertiaEnabled ? 'bg-blue-600' : isDark ? 'bg-slate-600' : 'bg-gray-300'
              }`}
            >
              <motion.div
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                animate={{ left: settings.flingInertiaEnabled ? '28px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ArrowLeftRight className={isDark ? 'text-slate-400' : 'text-gray-500'} size={20} />
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  边缘滑动返回
                </p>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  从屏幕边缘滑动返回上一页
                </p>
              </div>
            </div>
            <button
              onClick={() => updateSetting('edgeSwipeBackEnabled', !settings.edgeSwipeBackEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.edgeSwipeBackEnabled ? 'bg-blue-600' : isDark ? 'bg-slate-600' : 'bg-gray-300'
              }`}
            >
              <motion.div
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                animate={{ left: settings.edgeSwipeBackEnabled ? '28px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>
      </div>

      {settings.pinchRotateEnabled && (
        <div className={`p-6 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
          <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            旋转吸附设置
          </h3>
          <div className="flex items-center gap-3 mb-3">
            <Compass className={isDark ? 'text-slate-400' : 'text-gray-500'} size={20} />
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              选择旋转时自动吸附的角度
            </p>
          </div>
          <div className="flex flex-wrap gap-2 ml-8">
            {[
              { value: 15, label: '15°' },
              { value: 30, label: '30°' },
              { value: 45, label: '45°' },
              { value: 90, label: '90°' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => updateSetting('rotationSnapAngle', option.value as GestureSettings['rotationSnapAngle'])}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  settings.rotationSnapAngle === option.value
                    ? 'bg-blue-600 text-white'
                    : isDark
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`p-6 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          当前配置预览
        </h3>
        <div className={`p-4 rounded-lg font-mono text-sm ${isDark ? 'bg-slate-900 text-slate-300' : 'bg-gray-50 text-gray-700'}`}>
          <pre>{JSON.stringify(settings, null, 2)}</pre>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={handleReload}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
            isDark
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <RefreshCw size={16} />
          重置
        </button>
        <button
          onClick={handleReset}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
            isDark
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Hand size={16} />
          恢复默认
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <Save size={16} />
          )}
          保存设置
        </button>
      </div>
    </div>
  );
};
