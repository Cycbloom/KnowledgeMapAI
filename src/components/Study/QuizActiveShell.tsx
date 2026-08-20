import type { PropsWithChildren, ReactNode } from 'react';

interface QuizActiveShellProps {
  isDark: boolean;
  isMobile: boolean;
  header: ReactNode;
}

export function QuizActiveShell({
  isDark,
  isMobile,
  header,
  children,
}: PropsWithChildren<QuizActiveShellProps>) {
  void isMobile;

  return (
    <div
      className={`h-[100dvh] h-screen overflow-hidden overflow-x-hidden flex flex-col ${
        isDark
          ? 'dark:bg-slate-900 text-slate-100'
          : 'bg-gray-50 text-gray-900'
      }`}
      data-testid="active-shell"
    >
      <header className="flex-none border-b border-gray-200 dark:border-slate-700">
        {header}
      </header>
      <main className="flex-1 min-h-0 overflow-hidden flex items-center justify-center p-2 md:p-4 w-full">
        {children}
      </main>
    </div>
  );
}
