import React from 'react';

export const GraphSkeleton: React.FC = () => {
  return (
    <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="absolute top-4 left-4 right-4 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      
      <div className="absolute top-24 left-1/2 transform -translate-x-1/2">
        <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      </div>
      
      <div className="absolute top-40 left-1/4">
        <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" style={{ animationDelay: '100ms' }} />
      </div>
      
      <div className="absolute top-40 right-1/4">
        <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
      </div>
      
      <div className="absolute top-64 left-1/3">
        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
      
      <div className="absolute top-64 right-1/3">
        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
      </div>
      
      <div className="absolute top-80 left-1/5">
        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" style={{ animationDelay: '500ms' }} />
      </div>
      
      <div className="absolute top-80 right-1/5">
        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" style={{ animationDelay: '600ms' }} />
      </div>
      
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        <line x1="50%" y1="100" x2="25%" y2="160" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="2" strokeDasharray="4" />
        <line x1="50%" y1="100" x2="75%" y2="160" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="2" strokeDasharray="4" />
        <line x1="33%" y1="180" x2="25%" y2="256" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="2" strokeDasharray="4" />
        <line x1="67%" y1="180" x2="75%" y2="256" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="2" strokeDasharray="4" />
      </svg>
      
      <div className="absolute bottom-4 left-4 right-4 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" style={{ animationDelay: '700ms' }} />
    </div>
  );
};

export const GraphListSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3 animate-pulse" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4 animate-pulse" style={{ animationDelay: '100ms' }} />
          <div className="flex justify-between items-center">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" style={{ animationDelay: '200ms' }} />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const NodeEditorSkeleton: React.FC = () => {
  return (
    <div className="p-4 space-y-4">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
      
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ animationDelay: '100ms' }} />
      </div>
      
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse" style={{ animationDelay: '200ms' }} />
        <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
      
      <div className="flex gap-2">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" style={{ animationDelay: '400ms' }} />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse" style={{ animationDelay: '500ms' }} />
      </div>
    </div>
  );
};
