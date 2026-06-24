import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import type { Element } from 'hast';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  className?: string;
  children?: React.ReactNode;
  isDark?: boolean;
  node?: Element;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ 
  className, 
  children,
  isDark = false,
  node
}) => {
  const [copied, setCopied] = useState(false);
  
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeContent = String(children).replace(/\n$/, '');
  
  const isInline = !className && node?.tagName === 'code';
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (isInline) {
    return (
      <code className={cn('px-1.5 py-0.5 rounded text-sm font-mono', isDark ? 'bg-slate-700 text-pink-400' : 'bg-slate-100 text-pink-600')}>
        {children}
      </code>
    );
  }

  if (!language) {
    return (
      <code className={cn('block px-4 py-3 rounded-lg text-sm font-mono overflow-x-auto', isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-800')}>
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-4">
      <div className={cn('flex items-center justify-between px-4 py-2 rounded-t-lg text-xs font-medium', isDark ? 'bg-slate-800 text-slate-400 border-b border-slate-700' : 'bg-slate-200 text-slate-600 border-b border-slate-300')}>
        <span className="uppercase">{language}</span>
        <button
          onClick={handleCopy}
          className={cn('flex items-center gap-1 px-2 py-1 rounded transition-colors', isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-300 text-slate-500 hover:text-slate-700')}
          title="复制代码"
        >
          {copied ? (
            <>
              <Check size={14} />
              <span>已复制</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>复制</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={isDark ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: '0.5rem',
          borderBottomRightRadius: '0.5rem',
          fontSize: '0.875rem',
        }}
        showLineNumbers={codeContent.split('\n').length > 3}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          textAlign: 'right',
          opacity: 0.5,
        }}
      >
        {codeContent}
      </SyntaxHighlighter>
    </div>
  );
};

export const createCodeComponent = (isDark: boolean) => {
  return ({ className, children, node }: CodeBlockProps) => (
    <CodeBlock className={className} isDark={isDark} node={node}>
      {children}
    </CodeBlock>
  );
};
