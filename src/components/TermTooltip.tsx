import React from 'react';

interface TermTooltipProps {
  term: string;
  explanation: string;
}

export const TermTooltip: React.FC<TermTooltipProps> = ({ term, explanation }) => {
  return (
    <span className="relative group cursor-help inline-block">
      <span className="text-blue-600 dark:text-blue-400 border-b border-dashed border-blue-400 dark:border-blue-600 decoration-none">
        {term}
      </span>
      
      {/* Tooltip Content */}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-3 bg-gray-900/95 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 backdrop-blur-sm transform translate-y-1 group-hover:translate-y-0">
        {explanation}
        
        {/* Arrow */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900/95"></span>
      </span>
    </span>
  );
};
