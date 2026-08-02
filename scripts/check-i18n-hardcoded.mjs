#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const srcDir = 'd:/KnowledgeMap/src';

// Key component files that have Chinese characters (from the Grep results)
const filesToCheck = [
  'pages/GraphEditor.tsx',
  'pages/Dashboard.tsx',
  'pages/Study.tsx',
  'pages/Notes/NotesListPage.tsx',
  'pages/Scheduler.tsx',
  'pages/GraphMap.tsx',
  'pages/LearningMode.tsx',
  'pages/Tasks.tsx',
  'pages/Notes/NoteEditorPage.tsx',
  'pages/RecycleBin.tsx',
  'pages/Login.tsx',
  'components/Layout/Layout.tsx',
  'components/Layout/MobileBottomNav.tsx',
  'components/common/ShortcutHelpPanel.tsx',
  'components/common/MessageBar.tsx',
  'components/common/LoadingBar.tsx',
  'components/common/GlobalCommandPalette.tsx',
  'components/Dashboard/DashboardHeader.tsx',
  'components/Notes/NotesPanel.tsx',
  'components/Notes/InboundBlockRefsPanel.tsx',
  'components/Notes/NodeBlockRefsPanel.tsx',
  'components/Notes/BlockEditor.tsx',
  'components/Notes/extensions/BlockEmbedNodeView.tsx',
  'components/GraphEditor/toolbar/GraphToolbar.tsx',
  'components/GraphEditor/shared/CommandPalette.tsx',
  'components/GraphEditor/shared/NodePreviewCard.tsx',
  'components/GraphEditor/panels/BranchManagePanel.tsx',
  'components/GraphEditor/canvas/MindMapCanvas.tsx',
  'components/Study/QuestionForm.tsx',
  'components/Quiz/QuizList.tsx',
  'components/Learning/LearningFocusPanel.tsx',
  'components/Scheduler/ListView.tsx',
  'components/GraphMap/DomainFilter.tsx',
  'components/Console/CommandAutocomplete.tsx',
  'components/PwaDiagnostics/PwaDiagnostics.tsx',
  'components/PwaInstallButton/PwaInstallButton.tsx',
];

console.log('=== 检查组件中硬编码的中文字符 ===\n');

for (const relPath of filesToCheck) {
  const fullPath = join(srcDir, relPath);
  if (!existsSync(fullPath)) {
    console.log(`[SKIP] ${relPath} - not found`);
    continue;
  }
  
  const content = readFileSync(fullPath, 'utf8');
  const hasT = content.includes('useTranslation') || /t\(['"`]/.test(content);
  const hasChinese = /[\u4e00-\u9fff]/.test(content);
  
  if (!hasChinese) continue;
  
  // Find Chinese characters not inside t() calls
  // Remove t('...') and t("...") patterns
  const cleaned = content.replace(/t\(['"][^'"]*['"][^)]*\)/g, '');
  const remainingChinese = cleaned.match(/[\u4e00-\u9fff][\u4e00-\u9fff\w\s，。！？、；：""''（）【】《》\-\.\,\?\!]*[\u4e00-\u9fff]/g);
  
  if (remainingChinese && remainingChinese.length > 0) {
    console.log(`\n⚠️  ${relPath} (${hasT ? 'has t()' : 'NO t()'}):`);
    for (const match of remainingChinese.slice(0, 5)) {
      const trimmed = match.trim().substring(0, 80);
      console.log(`  - "${trimmed}"`);
    }
    if (remainingChinese.length > 5) {
      console.log(`  ... and ${remainingChinese.length - 5} more`);
    }
  }
}

console.log('\n=== 检查完成 ===');