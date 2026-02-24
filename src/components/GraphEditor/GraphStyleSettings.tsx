import React, { useState } from 'react';
import { ColorScheme, LinkStyle, LinkAnimation, NodeSizeMode, EdgeWidthMode, GraphColorMode } from '../../types';
import { getColorSchemeNames, COLOR_SCHEMES } from '../../config/learningStatusColors';

interface GraphStyleSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentColorScheme: ColorScheme;
  currentLinkStyle: LinkStyle;
  currentLinkAnimation: LinkAnimation;
  onColorSchemeChange: (scheme: ColorScheme) => void;
  onLinkStyleChange: (style: LinkStyle) => void;
  onLinkAnimationChange: (animation: LinkAnimation) => void;
  nodeSizeMode?: NodeSizeMode;
  onNodeSizeModeChange?: (mode: NodeSizeMode) => void;
  edgeWidthMode?: EdgeWidthMode;
  onEdgeWidthModeChange?: (mode: EdgeWidthMode) => void;
  coloringMode?: GraphColorMode;
}

export const GraphStyleSettings: React.FC<GraphStyleSettingsProps> = ({
  isOpen,
  onClose,
  currentColorScheme,
  currentLinkStyle,
  currentLinkAnimation,
  onColorSchemeChange,
  onLinkStyleChange,
  onLinkAnimationChange,
  nodeSizeMode = 'fixed',
  onNodeSizeModeChange,
  edgeWidthMode = 'fixed',
  onEdgeWidthModeChange,
  coloringMode = 'level'
}) => {
  const [activeTab, setActiveTab] = useState<'colors' | 'links' | 'animations' | 'nodes' | 'edges'>('colors');

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
          <button
            onClick={() => setActiveTab('nodes')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'nodes'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            节点大小
          </button>
          <button
            onClick={() => setActiveTab('edges')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'edges'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            边粗细
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'colors' && (
            <div className="space-y-4">
              {coloringMode === 'level' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    当前处于"结构"着色模式，配色方案仅在"热力图"模式下生效。
                  </p>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">选择配色方案</h3>
                <div className="grid grid-cols-3 gap-3">
                  {colorSchemes.map((scheme) => {
                    // Get representative colors for the scheme
                    const schemeColors = COLOR_SCHEMES[scheme.key] || COLOR_SCHEMES.default;
                    const previewColors = [
                      schemeColors.mastered.primary,
                      schemeColors.due.primary,
                      schemeColors.new.primary
                    ];

                    return (
                      <button
                        key={scheme.key}
                        onClick={() => onColorSchemeChange(scheme.key)}
                        disabled={coloringMode === 'level'}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          currentColorScheme === scheme.key
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                        } ${coloringMode === 'level' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            {previewColors.map((color, idx) => (
                              <div 
                                key={idx} 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{scheme.name}</span>
                        </div>
                      </button>
                    );
                  })}
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
                    {(() => {
                      const currentColors = COLOR_SCHEMES[currentColorScheme] || COLOR_SCHEMES.default;
                      return [
                        currentColors.mastered.primary,
                        currentColors.due.primary,
                        currentColors.new.primary,
                        currentColors.learning.primary,
                        currentColors.locked.primary
                      ].map((color, idx) => (
                        <div 
                          key={idx} 
                          className="w-8 h-8 rounded-full" 
                          style={{ backgroundColor: color }}
                        />
                      ));
                    })()}
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

          {activeTab === 'nodes' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">节点大小模式</h3>
                <div className="space-y-2">
                  {[
                    { key: 'fixed' as NodeSizeMode, name: '固定大小', description: '所有节点使用相同大小' },
                    { key: 'importance' as NodeSizeMode, name: '按重要性', description: '根据节点重要性动态调整' },
                    { key: 'degree' as NodeSizeMode, name: '按连接度', description: '根据连接数调整大小' },
                    { key: 'children' as NodeSizeMode, name: '按子节点数', description: '根据子节点数量调整大小' }
                  ].map((mode) => (
                    <button
                      key={mode.key}
                      onClick={() => onNodeSizeModeChange?.(mode.key)}
                      className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                        nodeSizeMode === mode.key
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{mode.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{mode.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'edges' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">边粗细模式</h3>
                <div className="space-y-2">
                  {[
                    { key: 'fixed' as EdgeWidthMode, name: '固定粗细', description: '所有边使用相同粗细' },
                    { key: 'strength' as EdgeWidthMode, name: '按连接强度', description: '根据连接强度动态调整' },
                    { key: 'relationship' as EdgeWidthMode, name: '按关系类型', description: '根据关系类型调整粗细' }
                  ].map((mode) => (
                    <button
                      key={mode.key}
                      onClick={() => onEdgeWidthModeChange?.(mode.key)}
                      className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                        edgeWidthMode === mode.key
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{mode.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{mode.description}</div>
                    </button>
                  ))}
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