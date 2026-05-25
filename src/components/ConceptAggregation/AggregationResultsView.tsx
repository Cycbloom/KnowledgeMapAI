import React, { useMemo } from 'react';
import {
  GitMerge,
  EyeOff,
  SplitSquareHorizontal,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Users,
  Layers,
} from 'lucide-react';
import type { NodeLevel, ConceptSource } from '../../types';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { SkeletonCard } from '../common/SkeletonCard';
import { getLevelLabel, getLevelColorHex } from '../../lib/graph/levelUtils';

export interface SimilarConceptMember {
  knowledgePointId: string;
  title: string;
  similarity?: number;
  sources: ConceptSource[];
  level: NodeLevel;
}

export interface SimilarConceptGroup {
  id: string;
  members: SimilarConceptMember[];
  suggestedTargetId: string;
  suggestedAliases: string[];
  autoMergeConfidence: number;
}

export interface AggregationResultsViewProps {
  similarGroups: SimilarConceptGroup[];
  onMerge: (groupId: string) => void;
  onIgnore: (groupId: string) => void;
  onSplit: (groupId: string, memberId: string) => void;
  isLoading?: boolean;
}

const SIMILARITY_COLORS = [
  { threshold: 0.9, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
  { threshold: 0.8, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  { threshold: 0.7, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
];

function getSimilarityStyle(similarity?: number) {
  if (similarity === undefined) return { color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' };
  
  const match = SIMILARITY_COLORS.find(({ threshold }) => similarity >= threshold);
  return match ? { color: match.color, bg: match.bg } : { color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' };
}

interface ConceptMemberCardProps {
  member: SimilarConceptMember;
  groupId: string;
  onSplit: (groupId: string, memberId: string) => void;
  isTarget?: boolean;
}

const ConceptMemberCard: React.FC<ConceptMemberCardProps> = ({
  member,
  groupId,
  onSplit,
  isTarget = false,
}) => {
  const similarityStyle = getSimilarityStyle(member.similarity);
  const levelColor = getLevelColorHex(member.level);

  return (
    <div
      className={`p-3 rounded-lg border transition-all ${
        isTarget
          ? 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/20'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isTarget && (
              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                目标
              </span>
            )}
            <h4 className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
              {member.title}
            </h4>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {member.similarity !== undefined && (
              <span
                className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${similarityStyle.bg} ${similarityStyle.color}`}
              >
                {(member.similarity * 100).toFixed(0)}% 相似
              </span>
            )}

            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded"
              style={{ backgroundColor: `${levelColor}20`, color: levelColor }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: levelColor }}
              />
              {getLevelLabel(member.level)}
            </span>
          </div>

          {member.sources.length > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Layers size={12} />
              <span>{member.sources.length} 个来源</span>
            </div>
          )}
        </div>

        {!isTarget && (
          <button
            onClick={() => onSplit(groupId, member.knowledgePointId)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="从组中移除"
          >
            <SplitSquareHorizontal size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

interface GroupCardProps {
  group: SimilarConceptGroup;
  onMerge: (groupId: string) => void;
  onIgnore: (groupId: string) => void;
  onSplit: (groupId: string, memberId: string) => void;
}

const GroupCard: React.FC<GroupCardProps> = ({
  group,
  onMerge,
  onIgnore,
  onSplit,
}) => {
  const targetMember = group.members.find(
    (m) => m.knowledgePointId === group.suggestedTargetId
  );
  const otherMembers = group.members.filter(
    (m) => m.knowledgePointId !== group.suggestedTargetId
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-primary-500" />
            <h3 className="font-semibold text-base text-slate-800 dark:text-slate-200">
              {targetMember?.title || group.suggestedAliases[0] || '未命名组'}
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            {group.autoMergeConfidence > 0 && (
              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${getSimilarityStyle(group.autoMergeConfidence).bg} ${getSimilarityStyle(group.autoMergeConfidence).color}`}>
                置信度 {(group.autoMergeConfidence * 100).toFixed(0)}%
              </span>
            )}
            
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {group.members.length} 个成员
            </span>
          </div>
        </div>

        {group.suggestedAliases.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {group.suggestedAliases.slice(0, 3).map((alias, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
              >
                {alias}
              </span>
            ))}
            {group.suggestedAliases.length > 3 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                +{group.suggestedAliases.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Members */}
      <div className="p-4 space-y-2">
        {targetMember && (
          <ConceptMemberCard
            member={targetMember}
            groupId={group.id}
            onSplit={onSplit}
            isTarget
          />
        )}
        
        {otherMembers.map((member) => (
          <ConceptMemberCard
            key={member.knowledgePointId}
            member={member}
            groupId={group.id}
            onSplit={onSplit}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<EyeOff size={14} />}
          onClick={() => onIgnore(group.id)}
        >
          忽略
        </Button>
        
        <Button
          variant="primary"
          size="sm"
          leftIcon={<GitMerge size={14} />}
          onClick={() => onMerge(group.id)}
        >
          合并组
        </Button>
      </div>
    </div>
  );
};

interface SummaryPanelProps {
  totalConcepts: number;
  groupCount: number;
  suggestedMerges: number;
  confirmedCount: number;
  ignoredCount: number;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({
  totalConcepts,
  groupCount,
  suggestedMerges,
  confirmedCount,
  ignoredCount,
}) => {
  const stats = [
    { label: '总概念数', value: totalConcepts, icon: <Users size={16} />, color: 'text-slate-700 dark:text-slate-300' },
    { label: '发现组数', value: groupCount, icon: <Layers size={16} />, color: 'text-primary-600 dark:text-primary-400' },
    { label: '建议合并', value: suggestedMerges, icon: <GitMerge size={16} />, color: 'text-blue-600 dark:text-blue-400' },
    { label: '已确认', value: confirmedCount, icon: <CheckCircle2 size={16} />, color: 'text-green-600 dark:text-green-400' },
    { label: '已忽略', value: ignoredCount, icon: <AlertCircle size={16} />, color: 'text-orange-600 dark:text-orange-400' },
  ];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-slate-500" />
        <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">变更摘要</h3>
      </div>
      
      <div className="grid grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className={`text-lg font-bold ${stat.color}`}>
              {stat.value}
            </div>
            <div className="flex items-center justify-center gap-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
              {stat.icon}
              <span>{stat.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AggregationResultsView: React.FC<AggregationResultsViewProps> = ({
  similarGroups,
  onMerge,
  onIgnore,
  onSplit,
  isLoading = false,
}) => {
  const summaryData = useMemo(() => {
    const totalConcepts = similarGroups.reduce(
      (sum, group) => sum + group.members.length,
      0
    );
    
    return {
      totalConcepts,
      groupCount: similarGroups.length,
      suggestedMerges: similarGroups.length,
      confirmedCount: 0,
      ignoredCount: 0,
    };
  }, [similarGroups]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SummaryPanel {...summaryData} />
        
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonCard key={index} lines={4} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (!similarGroups || similarGroups.length === 0) {
    return (
      <div className="space-y-6">
        <SummaryPanel {...summaryData} />
        
        <EmptyState
          illustration="empty"
          title="暂无聚合结果"
          description="系统未发现可合并的相似概念，或分析尚未完成"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Panel */}
      <SummaryPanel {...summaryData} />

      {/* Groups List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            相似概念分组
          </h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            共 {summaryData.groupCount} 组
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {similarGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onMerge={onMerge}
              onIgnore={onIgnore}
              onSplit={onSplit}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
