import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient, useIsFetching } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '@/utils/utils';

const PANEL_DIMENSIONS = { width: 320, height: 360 };

export const DevToolsPanel: React.FC = () => {
  // All hooks must be declared before any conditional return
  const [isVisible, setIsVisible] = useState(false);
  const queryClient = useQueryClient();
  const isFetching = useIsFetching();
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);

  // Re-render counter (useEffect triggers one extra render per actual render, acceptable for dev tool)
  const [renderCount, setRenderCount] = useState(0);
  useEffect(() => {
    setRenderCount((c) => c + 1);
  });

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  // Keyboard shortcut: Ctrl+Shift+D to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        e.stopPropagation();
        setIsVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        posX: position.x,
        posY: position.y,
      };
    },
    [position],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: dragStart.current.posX + (e.clientX - dragStart.current.mouseX),
        y: dragStart.current.posY + (e.clientY - dragStart.current.mouseY),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!import.meta.env.DEV) return null;

  // Query cache data
  const cachedQueries = queryClient.getQueryCache().getAll();
  const staleQueries = cachedQueries.filter((q) => q.isStale());
  const activeQueries = cachedQueries.filter((q) => q.state.fetchStatus === 'fetching');

  if (!isVisible) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Developer Tools Panel"
      className={cn(
        'fixed bottom-4 right-4 z-[9999] rounded-lg shadow-2xl overflow-hidden',
        'bg-gray-900/90 backdrop-blur-md border border-gray-700/50',
        'font-mono text-xs text-gray-200',
        isDragging ? 'cursor-grabbing select-none' : '',
      )}
      style={{
        width: PANEL_DIMENSIONS.width,
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2',
          'bg-gray-800/80 border-b border-gray-700/50',
          'cursor-move select-none',
        )}
        onMouseDown={handleMouseDown}
      >
        <span className="text-[11px] font-semibold tracking-wide text-gray-300 uppercase">
          DevTools
        </span>
        <button
          onClick={() => setIsVisible(false)}
          className={cn(
            'p-0.5 rounded transition-colors',
            'text-gray-500 hover:text-gray-200 hover:bg-gray-700',
          )}
          aria-label="Close dev tools panel"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 max-h-[310px] overflow-y-auto">
        {/* React Query Section */}
        <Section title="React Query">
          <InfoRow label="Cached queries" value={cachedQueries.length} />
          <InfoRow label="Fetching queries" value={isFetching} />
          <InfoRow label="Active queries" value={activeQueries.length} />
          <InfoRow label="Stale queries" value={staleQueries.length} />
        </Section>

        {/* Route Info Section */}
        <Section title="Route Info">
          <InfoRow label="Pathname" value={location.pathname} />
          <InfoRow label="Search" value={location.search || '(none)'} />
          <InfoRow label="Hash" value={location.hash || '(none)'} />
          {location.state && (
            <div className="pl-2 mt-1">
              <span className="text-gray-500">State:</span>
              <pre className="mt-0.5 text-[10px] text-gray-400 break-all whitespace-pre-wrap">
                {JSON.stringify(location.state, null, 1)}
              </pre>
            </div>
          )}
        </Section>

        {/* Render Count Section */}
        <Section title="Performance">
          <InfoRow label="Panel re-renders" value={renderCount} />
        </Section>
      </div>
    </div>
  );
};

/* ── Internal sub-components ── */

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <div>
    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 border-b border-gray-800 pb-1">
      {title}
    </div>
    <div className="space-y-0.5">{children}</div>
  </div>
);

interface InfoRowProps {
  label: string;
  value: string | number;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-gray-400 shrink-0">{label}</span>
    <span className="text-gray-100 text-right truncate max-w-[60%] font-medium">
      {value}
    </span>
  </div>
);