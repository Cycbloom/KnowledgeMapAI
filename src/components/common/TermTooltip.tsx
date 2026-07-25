import React, { useState, useRef, useId } from 'react';
import { createPortal } from 'react-dom';

interface TermTooltipProps {
  term: string;
  explanation: string;
}

export const TermTooltip: React.FC<TermTooltipProps> = ({ term, explanation }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, arrowOffset: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      const targetCenter = rect.left + rect.width / 2;
      
      // Assume max tooltip width is 240px + padding = ~260px safety
      const halfWidth = 120;
      const padding = 16;
      
      // Clamp the center position to ensure tooltip stays within screen bounds
      // Left boundary: halfWidth + padding
      // Right boundary: viewportWidth - halfWidth - padding
      const minCenter = halfWidth + padding;
      const maxCenter = viewportWidth - halfWidth - padding;
      
      const clampedLeft = Math.min(Math.max(targetCenter, minCenter), maxCenter);
      
      setCoords({
        top: rect.top,
        left: clampedLeft,
        arrowOffset: targetCenter - clampedLeft
      });
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <>
      <span
        ref={triggerRef}
        className="cursor-help inline-block border-b border-gray-400 border-dashed hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded-sm px-0.5"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        tabIndex={0}
        aria-describedby={tooltipId}
      >
        {term}
      </span>
      {isVisible && createPortal(
        <div
            className="fixed z-tooltip pointer-events-none"
            role="tooltip"
            id={tooltipId}
            style={{
                top: coords.top - 8, // 8px gap above the term
                left: coords.left,
                transform: 'translate(-50%, -100%)', // Center horizontally, move above
                width: 'max-content',
                maxWidth: '240px'
            }}
        >
            <div className="p-3 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 text-xs leading-relaxed rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 whitespace-normal text-left">
                {explanation}
            </div>
            
            {/* Arrow */}
            <div 
                className="absolute top-full"
                style={{ 
                    left: `calc(50% + ${coords.arrowOffset}px)`, 
                    transform: 'translateX(-50%)' 
                }}
            >
                <div className="border-4 border-transparent border-t-white dark:border-t-gray-900"></div>
            </div>
        </div>,
        document.body
      )}
    </>
  );
};
