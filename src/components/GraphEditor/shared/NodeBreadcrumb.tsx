import React from "react";
import { ChevronRight } from "lucide-react";
import { useTheme } from "../../../hooks";

export interface NodeBreadcrumbItem {
  id: string;
  title: string;
}

export interface NodeBreadcrumbProps {
  graphTitle: string;
  selectedNode: NodeBreadcrumbItem | null;
  /** 从根到当前节点父链上的节点（不含当前节点本身，含根节点），按从根到直接父级的顺序 */
  parentChain: NodeBreadcrumbItem[];
  /** 点击父节点时触发，传入节点 id */
  onSelectNode: (id: string) => void;
  /** 可选的容器 className，供外部定位 */
  className?: string;
}

export const NodeBreadcrumb: React.FC<NodeBreadcrumbProps> = ({
  graphTitle,
  selectedNode,
  parentChain,
  onSelectNode,
  className,
}) => {
  const { isDark } = useTheme();

  if (!selectedNode) {
    return null;
  }

  return (
    <nav
      aria-label="节点层级面包屑"
      className={`
        inline-flex items-center gap-1 max-w-full px-3 py-1.5 rounded-lg text-sm
        backdrop-blur-sm truncate
        ${isDark ? "bg-slate-900/70 text-slate-300" : "bg-white/70 text-gray-700"}
        ${className ?? ""}
      `}
    >
      {/* 图谱标题：起点，不可点击 */}
      <span
        className={`shrink-0 ${
          isDark ? "text-slate-400" : "text-gray-500"
        }`}
        title={graphTitle}
      >
        {graphTitle}
      </span>

      {/* 父节点链 */}
      {parentChain.map((parent) => (
        <React.Fragment key={parent.id}>
          <ChevronRight
            size={14}
            className={`shrink-0 ${isDark ? "text-slate-600" : "text-gray-400"}`}
          />
          <button
            type="button"
            onClick={() => onSelectNode(parent.id)}
            className={`
              shrink-0 max-w-[160px] truncate transition-colors
              ${isDark ? "text-slate-400 hover:text-slate-200" : "text-gray-500 hover:text-gray-700"}
            `}
            title={parent.title}
          >
            {parent.title}
          </button>
        </React.Fragment>
      ))}

      {/* 当前节点：高亮，不可点击 */}
      <ChevronRight
        size={14}
        className={`shrink-0 ${isDark ? "text-slate-600" : "text-gray-400"}`}
      />
      <span
        className={`shrink-0 max-w-[200px] truncate font-medium ${
          isDark ? "text-slate-100" : "text-gray-900"
        }`}
        title={selectedNode.title}
      >
        {selectedNode.title}
      </span>
    </nav>
  );
};

export default NodeBreadcrumb;
