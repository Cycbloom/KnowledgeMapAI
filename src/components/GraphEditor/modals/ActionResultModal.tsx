import React from "react";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { TermTooltip } from "../../common";
import { CodeBlock } from "../../common/CodeBlock";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { useTheme, useFocusTrap, useEscapeKey } from "../../../hooks";

interface ActionResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

export const ActionResultModal: React.FC<ActionResultModalProps> = ({
  isOpen,
  onClose,
  title,
  content,
}) => {
  const { isDark } = useTheme();
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => onClose(), isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        ref={containerRef}
        className={`w-full max-w-3xl max-h-[80vh] flex flex-col rounded-xl shadow-2xl ${
          isDark ? "bg-gray-800 text-white" : "bg-white text-gray-900"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDark ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="text-primary-500">✨</span>
            {title}
          </h2>
          <button
            onClick={onClose}
            className={`p-1 rounded-full transition-colors ${
              isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
            }`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                code: ({ className, children, node }) => (
                  <CodeBlock className={className} isDark={isDark} node={node}>
                    {children}
                  </CodeBlock>
                ),
                a: ({ node, ...props }) => {
                  const { href, children } = props;
                  if (href && href.startsWith("term:")) {
                    const explanation = href.replace("term:", "");
                    return (
                      <TermTooltip
                        term={String(children)}
                        explanation={decodeURIComponent(explanation)}
                      />
                    );
                  }
                  return (
                    <a
                      {...props}
                      className="text-primary-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-4 border-t flex justify-end ${
            isDark ? "border-gray-700" : "border-gray-200"
          }`}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
