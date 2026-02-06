import React, { useState } from 'react';
import { ColorScheme, NodeStyleVariant, LinkStyle, LinkAnimation, CenterDotShape, NodeShape } from '../../types';
import { getColorSchemeNames } from '../../config/learningStatusColors';

interface GraphStyleSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentColorScheme: ColorScheme;
  currentLinkStyle: LinkStyle;
  currentLinkAnimation: LinkAnimation;
  onColorSchemeChange: (scheme: ColorScheme) => void;
  onLinkStyleChange: (style: LinkStyle) => void;
  onLinkAnimationChange: (animation: LinkAnimation) => void;
}

export const GraphStyleSettings: React.FC<GraphStyleSettingsProps> = ({
  isOpen,
  onClose,
  currentColorScheme,
  currentLinkStyle,
  currentLinkAnimation,
  onColorSchemeChange,
  onLinkStyleChange,
  onLinkAnimationChange
}) => {
  const [activeTab, setActiveTab] = useState<'colors' | 'links' | 'animations'>('colors');

  if (!isOpen) return null;

  const colorSchemes = getColorSchemeNames();
  const linkStyles: { key: LinkStyle; name: string }[] = [
    { key: 'curved', name: '曲线' },
    { key: 'straight', name: '直线' },
    { key: 'step', name: '折线' },
    { key: 'bezier', name: '贝塞尔' }
  ];
  const linkAnimations: { key: LinkAnimation; name: string }[] = [
    { key: 'none', name: '无' },
    { key: 'flow', name: '流动' },
    { key: 'pulse', name: '脉冲' },
    { key: 'dash', name: '虚线' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">样式设置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('colors')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'colors'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            配色方案
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'links'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            连接线样式
          </button>
          <button
            onClick={() => setActiveTab('animations')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'animations'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            动画效果
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'colors' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">选择配色方案</h3>
                <div className="grid grid-cols-3 gap-3">
                  {colorSchemes.map((scheme) => (
                    <button
                      key={scheme.key}
                      onClick={() => onColorSchemeChange(scheme.key)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        currentColorScheme === scheme.key
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{scheme.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">当前方案</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {colorSchemes.find(s => s.key === currentColorScheme)?.name}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <div className="w-8 h-8 rounded-full bg-green-500"></div>
                    <div className="w-8 h-8 rounded-full bg-orange-500"></div>
                    <div className="w-8 h-8 rounded-full bg-blue-500"></div>
                    <div className="w-8 h-8 rounded-full bg-purple-500"></div>
                    <div className="w-8 h-8 rounded-full bg-gray-500"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'links' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">连接线样式</h3>
                <div className="grid grid-cols-2 gap-3">
                  {linkStyles.map((style) => (
                    <button
                      key={style.key}
                      onClick={() => onLinkStyleChange(style.key)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        currentLinkStyle === style.key
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        <svg width="100" height="40" viewBox="0 0 100 40">
                          {style.key === 'curved' && (
                            <path d="M 10 20 Q 50 10 90 20" fill="none" stroke="currentColor" strokeWidth="2" />
                          )}
                          {style.key === 'straight' && (
                            <path d="M 10 20 L 90 20" fill="none" stroke="currentColor" strokeWidth="2" />
                          )}
                          {style.key === 'step' && (
                            <path d="M 10 20 L 50 20 L 50 20 L 90 20" fill="none" stroke="currentColor" strokeWidth="2" />
                          )}
                          {style.key === 'bezier' && (
                            <path d="M 10 20 Q 50 5 90 20" fill="none" stroke="currentColor" strokeWidth="2" />
                          )}
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 mt-2 block">{style.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'animations' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">连接线动画</h3>
                <div className="grid grid-cols-2 gap-3">
                  {linkAnimations.map((animation) => (
                    <button
                      key={animation.key}
                      onClick={() => onLinkAnimationChange(animation.key)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        currentLinkAnimation === animation.key
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        <svg width="100" height="40" viewBox="0 0 100 40">
                          <path
                            d="M 10 20 Q 50 10 90 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray={animation.key === 'dash' ? '5, 5' : animation.key === 'flow' ? '10, 10' : 'none'}
                            className={animation.key !== 'none' ? 'animate-pulse' : ''}
                          />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 mt-2 block">{animation.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">动画说明</h4>
                  <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• <strong>流动</strong>: 连接线上的虚线会持续流动</li>
                    <li>• <strong>脉冲</strong>: 连接线会有呼吸般的明暗变化</li>
                    <li>• <strong>虚线</strong>: 显示为虚线样式</li>
                    <li>• <strong>无</strong>: 不显示任何动画效果</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};