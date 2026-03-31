import React, { useState } from 'react';
import { Bot, Wrench, CheckCircle2, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import type { AgentSession } from '../../services/api/agent';

interface SessionLogProps {
  session: AgentSession;
}

export const SessionLog: React.FC<SessionLogProps> = ({ session }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 w-full"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <span>分析过程</span>
        <span className="text-xs">({session.toolCalls.length} 个工具调用)</span>
      </button>
      
      {isExpanded && (
        <div className="space-y-2 pl-2 border-l-2 border-gray-200 dark:border-slate-700">
          {session.messages
            .filter(m => m.role !== 'system')
            .map((message, index) => (
              <div
                key={message.id || index}
                className={`flex items-start gap-2 p-2 rounded text-xs ${
                  message.role === 'tool'
                    ? 'bg-gray-50 dark:bg-slate-800'
                    : 'bg-indigo-50 dark:bg-indigo-900/20'
                }`}
              >
                {message.role === 'assistant' && <Bot className="w-3 h-3 text-indigo-600 dark:text-indigo-400 mt-0.5" />}
                {message.role === 'tool' && <Wrench className="w-3 h-3 text-gray-500 dark:text-gray-400 mt-0.5" />}
                {message.role === 'user' && <span className="w-3 h-3 text-gray-400">👤</span>}
                
                <div className="flex-1 min-w-0">
                  {message.role === 'tool' && message.toolName && (
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      调用工具: {message.toolName}
                    </div>
                  )}
                  <div className="text-gray-600 dark:text-gray-400 line-clamp-2">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}

          {session.toolCalls.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {session.toolCalls.map((tc, index) => (
                <div
                  key={tc.id || index}
                  className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-xs"
                >
                  {tc.status === 'completed' ? (
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                  ) : (
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                  )}
                  <span className="text-gray-600 dark:text-gray-300">{tc.toolName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
