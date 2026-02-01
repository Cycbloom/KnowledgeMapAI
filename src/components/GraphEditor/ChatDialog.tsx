import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageSquare, Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { api } from '../../services/api';
import { preprocessMarkdown } from '../../utils/markdownUtils';
import { useMessageStore } from '../../store/useMessageStore';

interface ChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  graphId: string;
  selectedNodeIds: string[];
}

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
};

export const ChatDialog: React.FC<ChatDialogProps> = ({ isOpen, onClose, graphId, selectedNodeIds }) => {
  const { addMessage } = useMessageStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是你的图谱助手。你可以问我关于这个知识图谱的任何问题。如果选中了特定节点，我会优先基于选中的内容回答。'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      let fullContent = '';
      
      // Convert messages to AI history format
      const history = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      await api.ai.chatStream(
        {
          message: userMessage.content,
          graph_id: graphId,
          history: history,
          context_node_ids: selectedNodeIds.length > 0 ? selectedNodeIds : undefined
        },
        (chunk) => {
          fullContent += chunk;
          setMessages(prev => prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: fullContent }
              : msg
          ));
        }
      );

      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, isStreaming: false }
          : msg
      ));

    } catch (error: any) {
      console.error('Chat error:', error);
      addMessage({ type: 'error', content: '发送失败，请重试' });
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: '抱歉，我现在无法回答。请稍后再试。', isStreaming: false }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 h-[600px] bg-white rounded-xl shadow-2xl flex flex-col border border-gray-200 animate-in slide-in-from-bottom-10 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-t-xl">
        <div className="flex items-center space-x-2">
          <MessageSquare size={20} />
          <h2 className="font-semibold">图谱助手</h2>
        </div>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded-full transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start space-x-2 ${
              msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            }`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
            }`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
            }`}>
              <div className={`leading-relaxed ${msg.role === 'assistant' ? 'prose prose-sm prose-blue max-w-none' : 'whitespace-pre-wrap'}`}>
                {msg.role === 'assistant' ? (
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]} 
                    rehypePlugins={[[rehypeKatex, { output: 'html' }]]}
                  >
                    {preprocessMarkdown(msg.content)}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
                {msg.isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-1 bg-green-500 animate-pulse align-middle" />
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100 bg-white rounded-b-xl">
        {selectedNodeIds.length > 0 && (
          <div className="mb-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
            已选中 {selectedNodeIds.length} 个节点作为上下文
          </div>
        )}
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="问点什么..."
            className="flex-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
};
