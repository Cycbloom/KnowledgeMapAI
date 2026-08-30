import React, { useState, useRef, useEffect, useMemo, useId, useCallback } from 'react';
import { Globe, ChevronDown, Check, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DomainTreeNode } from '@shared/types/graph';
import { useIsMobile } from '../../hooks';
import { useCombobox } from '../../hooks/common/useCombobox';

interface DomainFilterProps {
  domains: DomainTreeNode[];
  selectedDomainIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  domainGraphCount?: Map<string, number>;
  /** 当前悬停的领域 id（用于画布联动高亮）；onHoverDomainChange 在悬停/移出时触发 */
  hoveredDomainId?: string | null;
  onHoverDomainChange?: (id: string | null) => void;
}

interface DomainTreeItemProps {
  domain: DomainTreeNode;
  selectedDomainIds: Set<string>;
  onToggle: (domainId: string) => void;
  depth: number;
  expandedIds: Set<string>;
  onToggleExpand: (domainId: string) => void;
  graphCount?: number;
  graphCountMap?: Map<string, number>;
  /** 域 ID -> option DOM id 的映射，用于 role="option" 的 id 与 aria-activedescendant 对齐 */
  optionIdMap?: Map<string, string>;
  /** 当前项是否处于悬停状态（画布联动的高亮提示） */
  hovered?: boolean;
  onHoverDomainChange?: (id: string | null) => void;
}

const DomainTreeItemComponent: React.FC<DomainTreeItemProps> = ({
  domain,
  selectedDomainIds,
  onToggle,
  depth,
  expandedIds,
  onToggleExpand,
  graphCount,
  graphCountMap,
  optionIdMap,
  hovered = false,
  onHoverDomainChange,
}) => {
  const hasChildren = domain.children && domain.children.length > 0;
  const isExpanded = expandedIds.has(domain.id);
  const isSelected = selectedDomainIds.has(domain.id);

  return (
    <div>
      <button
        onClick={() => onToggle(domain.id)}
        role="option"
        aria-selected={isSelected}
        id={optionIdMap?.get(domain.id)}
        onMouseEnter={() => onHoverDomainChange?.(domain.id)}
        onMouseLeave={() => onHoverDomainChange?.(null)}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md transition-colors ${
          hovered
            ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-600'
            : isSelected
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(domain.id);
            }}
            className="flex-shrink-0 p-0.5"
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} aria-hidden="true" />
          </span>
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: domain.color || '#94A3B8' }}
        />
        <span className="flex-1 text-left truncate">{domain.name}</span>
        {graphCount !== undefined && graphCount > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500 mr-1 flex-shrink-0">
            ({graphCount})
          </span>
        )}
        {isSelected && (
          <Check className="w-4 h-4 flex-shrink-0 text-primary-500 dark:text-primary-400" aria-hidden="true" />
        )}
      </button>
      {hasChildren && isExpanded && (
        <div>
          {domain.children.map((child) => (
            <DomainTreeItem
              key={child.id}
              domain={child}
              selectedDomainIds={selectedDomainIds}
              onToggle={onToggle}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              graphCount={graphCountMap?.get(child.id)}
              graphCountMap={graphCountMap}
              optionIdMap={optionIdMap}
              hovered={false}
              onHoverDomainChange={onHoverDomainChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const areEqual = (prev: DomainTreeItemProps, next: DomainTreeItemProps) => {
  return (
    prev.domain.id === next.domain.id &&
    prev.depth === next.depth &&
    prev.graphCount === next.graphCount &&
    prev.hovered === next.hovered &&
    prev.selectedDomainIds.has(prev.domain.id) === next.selectedDomainIds.has(next.domain.id) &&
    prev.expandedIds.has(prev.domain.id) === next.expandedIds.has(next.domain.id) &&
    prev.onToggle === next.onToggle &&
    prev.onToggleExpand === next.onToggleExpand
  );
};

const DomainTreeItem = React.memo(DomainTreeItemComponent, areEqual);

export const DomainFilter: React.FC<DomainFilterProps> = ({
  domains,
  selectedDomainIds,
  onSelectionChange,
  domainGraphCount,
  hoveredDomainId,
  onHoverDomainChange,
}) => {
  const deviceInfo = useIsMobile();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const d of domains) {
      if (d.children && d.children.length > 0) {
        initial.add(d.id);
      }
    }
    return initial;
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDomains = useMemo(() => {
    if (!searchQuery.trim()) return domains;

    const query = searchQuery.toLowerCase().trim();

    function filterTree(nodes: DomainTreeNode[]): DomainTreeNode[] {
      return nodes.reduce<DomainTreeNode[]>((acc, node) => {
        const nameMatch = node.name.toLowerCase().includes(query);
        const matchedChildren = node.children ? filterTree(node.children) : [];

        if (nameMatch || matchedChildren.length > 0) {
          acc.push({
            ...node,
            children: matchedChildren.length > 0 ? matchedChildren : node.children,
          });
        }
        return acc;
      }, []);
    }

    return filterTree(domains);
  }, [domains, searchQuery]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const autoExpanded = new Set<string>();
      function collectExpandableIds(nodes: DomainTreeNode[]) {
        for (const node of nodes) {
          if (node.children && node.children.length > 0) {
            autoExpanded.add(node.id);
            collectExpandableIds(node.children);
          }
        }
      }
      collectExpandableIds(filteredDomains);
      setExpandedIds(autoExpanded);
    }
  }, [searchQuery, filteredDomains]);

  const isMobile = deviceInfo.isMobile;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (domainId: string) => {
    const next = new Set(selectedDomainIds);
    if (next.has(domainId)) {
      next.delete(domainId);
    } else {
      next.add(domainId);
    }
    onSelectionChange(next);
  };

  const handleSelectAll = () => {
    onSelectionChange(new Set());
    setIsOpen(false);
  };

  const handleToggleExpand = (domainId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(domainId)) {
        next.delete(domainId);
      } else {
        next.add(domainId);
      }
      return next;
    });
  };

  // 仅展开可见的域节点扁平化，供 useCombobox 键盘导航使用
  const flattenedDomains = useMemo(() => {
    const result: DomainTreeNode[] = [];
    const collect = (nodes: DomainTreeNode[]) => {
      for (const node of nodes) {
        result.push(node);
        if (node.children && expandedIds.has(node.id)) {
          collect(node.children);
        }
      }
    };
    collect(filteredDomains);
    return result;
  }, [filteredDomains, expandedIds]);

  const baseId = useId();
  const getOptionId = useCallback(
    (index: number) => `${baseId}-opt-${flattenedDomains[index]?.id ?? index}`,
    [baseId, flattenedDomains],
  );

  const { activeId, handleKeyDown, resetActive } = useCombobox<DomainTreeNode>({
    options: flattenedDomains,
    isOpen,
    setIsOpen,
    onSelect: (domain) => handleToggle(domain.id),
    getOptionId,
    getOptionLabel: (domain) => domain.name,
  });

  const optionIdMap = useMemo(() => {
    const map = new Map<string, string>();
    flattenedDomains.forEach((domain, index) => {
      map.set(domain.id, getOptionId(index));
    });
    return map;
  }, [flattenedDomains, getOptionId]);

  useEffect(() => {
    if (!isOpen) {
      resetActive();
    }
  }, [isOpen, resetActive]);

  const selectedCount = selectedDomainIds.size;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={`${baseId}-listbox`}
        aria-haspopup="listbox"
        role="combobox"
        aria-activedescendant={activeId}
        onKeyDown={(e) => handleKeyDown(e.nativeEvent)}
        className={`flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors`}
      >
        <Globe className="w-4 h-4" aria-hidden="true" />
        <span>{t('graphMap.domainFilter.title')}</span>
        {selectedCount > 0 && (
          <span className="min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-primary-500 text-white text-xs rounded-full">
            {selectedCount}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          id={`${baseId}-listbox`}
          className={`absolute top-full left-0 mt-1 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-gray-200 dark:border-slate-500 z-50 ${
            isMobile ? 'w-[280px]' : 'w-[240px]'
          } max-h-[360px] overflow-y-auto p-1.5`}
        >
          <button
            onClick={handleSelectAll}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md mb-1 ${
              selectedCount === 0
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'
            }`}
          >
            <span className="w-3.5" />
            <span>{t('graphMap.domainFilter.all')}</span>
            {selectedCount === 0 && (
              <Check className="w-4 h-4 ml-auto text-primary-500 dark:text-primary-400" aria-hidden="true" />
            )}
          </button>

          <div className="relative mb-1">
            <input
              type="text"
              aria-label={t('common.aria.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('graphMap.domainFilter.searchPlaceholder')}
              className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 dark:border-slate-500 rounded-md bg-white dark:bg-slate-600 text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-primary-500"
            />
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="border-t border-gray-100 dark:border-slate-500 pt-1">
            {filteredDomains.length === 0 && searchQuery.trim() && (
              <div className="px-2 py-4 text-center text-sm text-gray-400 dark:text-gray-500">
                {t('graphMap.domainFilter.noMatch')}
              </div>
            )}
            {filteredDomains.map((domain) => (
              <DomainTreeItem
                key={domain.id}
                domain={domain}
                selectedDomainIds={selectedDomainIds}
                onToggle={handleToggle}
                depth={0}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
                graphCount={domainGraphCount?.get(domain.id)}
                graphCountMap={domainGraphCount}
                optionIdMap={optionIdMap}
                hovered={hoveredDomainId === domain.id}
                onHoverDomainChange={onHoverDomainChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
