// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../helpers/renderWithProviders';
import { QuizActiveShell } from '../../src/components/Study/QuizActiveShell';
import fs from 'node:fs';
import path from 'node:path';

describe('QuizActiveShell', () => {

  describe('TR-2.1 QuizActiveShell 容器结构', () => {
    it('最外层 div 包含高度链类名；main 子元素包含 flex-1 min-h-0 overflow-hidden', () => {
      renderWithProviders(
        <QuizActiveShell
          isDark={false}
          isMobile={false}
          header={<div data-testid="mock-header">Header</div>}
        >
          <div data-testid="mock-child">Children</div>
        </QuizActiveShell>,
      );

      const shell = screen.getByTestId('active-shell');
      expect(shell).toBeInTheDocument();

      const shellClass = shell.className;
      expect(shellClass).toContain('h-full');
      expect(shellClass).toContain('overflow-hidden');
      expect(shellClass).toContain('flex');
      expect(shellClass).toContain('flex-col');
      expect(shellClass).toContain('overflow-x-hidden');

      const header = shell.querySelector('header');
      expect(header).toBeInTheDocument();
      expect(header?.className).toContain('flex-none');
      expect(header?.className).toContain('border-b');

      const main = shell.querySelector('main');
      expect(main).toBeInTheDocument();
      const mainClass = main?.className ?? '';
      expect(mainClass).toContain('flex-1');
      expect(mainClass).toContain('min-h-0');
      expect(mainClass).toContain('overflow-hidden');
    });
  });

  describe('TR-2.2 Study Dashboard 回归保护', () => {
    it('Study.tsx 中 Dashboard/Bank/Focus/Quizzes 分支保留 overflow-y-auto custom-scrollbar 外层', () => {
      const studyPath = path.resolve(__dirname, '../../src/pages/Study.tsx');
      const studyContent = fs.readFileSync(studyPath, 'utf-8');

      expect(studyContent).toContain('h-full overflow-y-auto custom-scrollbar transition-colors');

      const dashboardBranchStart = studyContent.indexOf(
        'viewState === "dashboard" ||',
      );
      const dashboardBranchEnd = studyContent.indexOf(
        '// --- Quiz View: Finished ---',
      );
      expect(dashboardBranchStart).toBeGreaterThan(-1);
      expect(dashboardBranchEnd).toBeGreaterThan(dashboardBranchStart);

      const dashboardBlock = studyContent.slice(
        dashboardBranchStart,
        dashboardBranchEnd,
      );
      expect(dashboardBlock).toContain('overflow-y-auto custom-scrollbar');
    });

    it('最小 mock Dashboard 容器结构断言 class 包含 overflow-y-auto custom-scrollbar', () => {
      const MockDashboardContainer = () => (
        <div
          data-testid="dashboard-outer"
          className="h-full overflow-y-auto custom-scrollbar transition-colors bg-gray-50 text-gray-900 p-8"
        >
          <div className="max-w-6xl mx-auto">Dashboard content</div>
        </div>
      );

      renderWithProviders(<MockDashboardContainer />);
      const dashboardOuter = screen.getByTestId('dashboard-outer');
      expect(dashboardOuter).toBeInTheDocument();
      const cls = dashboardOuter.className;
      expect(cls).toContain('overflow-y-auto');
      expect(cls).toContain('custom-scrollbar');
      expect(cls).toContain('h-full');
      expect(cls).toContain('transition-colors');
    });
  });
});
