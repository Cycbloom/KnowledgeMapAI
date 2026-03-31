import React from 'react';
import { Network, Route, GitBranch, AlertTriangle, Link2 } from 'lucide-react';
import type { SkillDefinition } from '../../services/api/agent';

const SKILL_ICONS: Record<string, React.ReactNode> = {
  island_detection: <Network className="w-5 h-5" />,
  learning_path: <Route className="w-5 h-5" />,
  cross_domain: <GitBranch className="w-5 h-5" />,
  knowledge_gaps: <AlertTriangle className="w-5 h-5" />,
  relation_recommendation: <Link2 className="w-5 h-5" />,
};

interface SkillSelectorProps {
  skills: SkillDefinition[];
  selectedGraphCount: number;
  onSelect: (skill: SkillDefinition) => void;
}

export const SkillSelector: React.FC<SkillSelectorProps> = ({
  skills,
  selectedGraphCount,
  onSelect,
}) => {
  return (
    <div className="space-y-4">
      {selectedGraphCount > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 p-3 rounded-lg text-sm">
          已选择 {selectedGraphCount} 个图谱进行分析
        </div>
      )}

      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">选择分析类型</h3>

      <div className="space-y-2">
        {skills.map((skill) => (
          <button
            key={skill.id}
            onClick={() => onSelect(skill)}
            className="w-full flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/60 transition-colors">
              {SKILL_ICONS[skill.id] || <Network className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-white">{skill.name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{skill.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
