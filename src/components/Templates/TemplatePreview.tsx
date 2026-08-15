import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Template, TemplateNode, TemplateDifficulty } from '../../types';
import { ChevronRight, Edit3, Check, Save, Tag, Layers, LayoutGrid, GitBranch } from 'lucide-react';
import { useTheme } from "../../hooks";

interface TemplatePreviewProps {
  template: Template;
  showActions?: boolean;
  onSelect?: () => void;
  onSave?: () => void;
  onEdit?: () => void;
}

const difficultyColors = (isDark: boolean): Record<TemplateDifficulty, string> => {
  if (isDark) {
    return {
      easy: 'bg-green-900/50 text-green-400 border-green-800',
      medium: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
      hard: 'bg-red-900/50 text-red-400 border-red-800',
    };
  }
  return {
    easy: 'bg-green-50 text-green-600 border-green-200',
    medium: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    hard: 'bg-red-50 text-red-600 border-red-200',
  };
};

const getNodeLevelColor = (level: string, isDark: boolean) => {
  if (isDark) {
    switch (level) {
      case 'root':
        return 'bg-primary-600 text-white';
      case 'core':
        return 'bg-primary-600 text-white';
      case 'sub':
        return 'bg-primary-600 text-white';
      case 'leaf':
        return 'bg-emerald-600 text-white';
      default:
        return 'bg-slate-700 text-slate-300';
    }
  }
  switch (level) {
    case 'root':
      return 'bg-primary-500 text-white';
    case 'core':
      return 'bg-primary-500 text-white';
    case 'sub':
      return 'bg-primary-500 text-white';
    case 'leaf':
      return 'bg-emerald-500 text-white';
    default:
      return 'bg-gray-200 text-gray-700';
  }
};

const levelLabels: Record<string, string> = {
  root: 'R',
  core: 'C',
  sub: 'S',
  leaf: 'L',
  normal: 'N',
};

const TreeNode: React.FC<{
  node: TemplateNode;
  childrenByParent: Map<string, TemplateNode[]>;
  depth: number;
  isDark: boolean;
}> = memo(({ node, childrenByParent, depth, isDark }) => {
  const children = useMemo(
    () => childrenByParent.get(node.id) ?? [],
    [childrenByParent, node.id]
  );

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={`flex flex-col gap-1 py-2 px-3 rounded-lg transition-all ${
          isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'
        }`}
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <div className="flex items-center gap-2">
          {depth > 0 && (
            <ChevronRight
              size={12}
              className={`${isDark ? 'text-slate-500' : 'text-gray-400'} flex-shrink-0`}
            />
          )}
          <span
            className={`text-xs font-medium px-1.5 py-0.5 rounded ${getNodeLevelColor(
              node.level,
              isDark
            )}`}
          >
            {levelLabels[node.level] || node.level}
          </span>
          <span
            className={`text-sm font-medium truncate flex-1 ${
              isDark ? 'text-slate-200' : 'text-gray-800'
            }`}
          >
            {node.title}
          </span>
          {node.aiPrompt && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                isDark
                  ? 'bg-primary-900/50 text-primary-400'
                  : 'bg-primary-50 text-primary-500'
              }`}
            >
              AI
            </span>
          )}
        </div>
        {node.description && (
          <div
            className={`text-xs leading-relaxed pl-6 ${
              isDark ? 'text-slate-400' : 'text-gray-500'
            }`}
            style={{ marginLeft: depth > 0 ? '28px' : '12px' }}
          >
            {node.description}
          </div>
        )}
      </div>
      {children.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          childrenByParent={childrenByParent}
          depth={depth + 1}
          isDark={isDark}
        />
      ))}
    </div>
  );
});

TreeNode.displayName = 'TreeNode';

const TemplatePreviewComponent: React.FC<TemplatePreviewProps> = ({
  template,
  showActions = true,
  onSelect,
  onSave,
  onEdit,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const nodes = template.nodes ? [...template.nodes] : [];
  const edges = template.edges || [];
  const tags = template.tags || [];
  const difficulty = template.difficulty || 'medium';
  const estimatedNodes = template.estimated_nodes || nodes.length;
  const layoutSuggestion = template.layout_suggestion;

  const rootNode = useMemo(() => nodes.find(n => !n.parentId), [nodes]);

  // 预构建 parentId -> 子节点 映射，避免递归渲染时每个节点过滤全部 nodes（原为 O(nodes*nodes)）
  const childrenByParent = useMemo(() => {
    const m = new Map<string, TemplateNode[]>();
    nodes.forEach(n => {
      if (n.parentId) {
        const list = m.get(n.parentId);
        if (list) {
          list.push(n);
        } else {
          m.set(n.parentId, [n]);
        }
      }
    });
    return m;
  }, [nodes]);

  const nodeCountByLevel = useMemo(() => {
    const counts: Record<string, number> = {
      root: 0,
      core: 0,
      sub: 0,
      leaf: 0,
      normal: 0,
    };
    nodes.forEach(n => {
      if (counts[n.level] !== undefined) {
        counts[n.level]++;
      }
    });
    return counts;
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div
        className={`p-6 text-center ${isDark ? 'text-slate-500' : 'text-gray-500'}`}
      >
        {t("templates.empty.noNodes")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`p-4 rounded-xl border ${
          isDark
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-gray-200'
        }`}
      >
        <h3
          className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
        >
          {template.name}
        </h3>
        {template.description && (
          <p
            className={`text-sm mb-3 ${isDark ? 'text-slate-400' : 'text-gray-600'}`}
          >
            {template.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-3">
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag size={12} className={isDark ? 'text-slate-500' : 'text-gray-400'} />
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    isDark
                      ? 'bg-slate-700 text-slate-300'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded border ${
                difficultyColors(isDark)[difficulty]
              }`}
            >
              {t(`templates.difficulty.${difficulty}`)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Layers size={12} className={isDark ? 'text-slate-500' : 'text-gray-400'} />
            <span className={isDark ? 'text-slate-400' : 'text-gray-600'}>
              {t("templates.preview.nodeCount", { count: estimatedNodes })}
            </span>
          </div>

          {layoutSuggestion && (
            <div className="flex items-center gap-1.5">
              <LayoutGrid size={12} className={isDark ? 'text-slate-500' : 'text-gray-400'} />
              <span className={isDark ? 'text-slate-400' : 'text-gray-600'}>
                {t(`templates.layout.${layoutSuggestion}`)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <GitBranch size={12} className={isDark ? 'text-slate-500' : 'text-gray-400'} />
            <span className={isDark ? 'text-slate-400' : 'text-gray-600'}>
              {t("templates.preview.edgeCount", { count: edges.length })}
            </span>
          </div>
        </div>
      </div>

      <div
        className={`p-4 rounded-xl border ${
          isDark
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-gray-50 border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <h4
            className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}
          >
            {t("templates.preview.structure")}
          </h4>
          <div className="flex gap-2 text-[10px]">
            {Object.entries(nodeCountByLevel).map(([level, count]) => {
              if (count === 0) return null;
              return (
                <span
                  key={level}
                  className={`px-1.5 py-0.5 rounded ${getNodeLevelColor(level, isDark)}`}
                >
                  {levelLabels[level]}: {count}
                </span>
              );
            })}
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {rootNode ? (
            <TreeNode
              node={rootNode}
              childrenByParent={childrenByParent}
              depth={0}
              isDark={isDark}
            />
          ) : (
            <div className={isDark ? 'text-slate-500' : 'text-gray-500'}>
              {t("templates.preview.rootNodeNotFound")}
            </div>
          )}
        </div>
      </div>

      {showActions && (
        <div className="flex gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                isDark
                  ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Edit3 size={16} />
              {t("templates.button.edit")}
            </button>
          )}
          {onSelect && (
            <button
              onClick={onSelect}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              <Check size={16} />
              {t("templates.select")}
            </button>
          )}
          {onSave && (
            <button
              onClick={onSave}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                isDark
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
              }`}
            >
              <Save size={16} />
              {t("templates.button.save")}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const TemplatePreview = memo(TemplatePreviewComponent);
