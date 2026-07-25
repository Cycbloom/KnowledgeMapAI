import React from 'react';
import { Network, Route, GitBranch, AlertTriangle, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      {selectedGraphCount > 0 && (
        <div className="bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 p-3 rounded-lg text-sm">
          {t('graphMap.skillSelector.selectedForAnalysis', { count: selectedGraphCount })}
        </div>
      )}

      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('graphMap.skillSelector.selectType')}</h3>

      <div className="space-y-2">
        {skills.map((skill) => (
          <button
            key={skill.id}
            onClick={() => onSelect(skill)}
            className="w-full flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-slate-500 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 group-hover:bg-primary-200 dark:group-hover:bg-primary-900/60 transition-colors">
              {SKILL_ICONS[skill.id] || <Network className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium text-gray-900 dark:text-white">{skill.name}</div>
                {skill.allowWrite && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    执行型
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{skill.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
