import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 替换 ../../../hooks/ 路径
  const replacements = [
    { from: "../../../hooks/useTheme", to: "../../../hooks" },
    { from: "../../../hooks/useIsMobile", to: "../../../hooks" },
    { from: "../../../hooks/useSearch", to: "../../../hooks" },
    { from: "../../../hooks/usePerformance", to: "../../../hooks" },
    { from: "../../../hooks/useKeyboardShortcuts", to: "../../../hooks" },
    { from: "../../../hooks/useGlobalShortcuts", to: "../../../hooks" },
    { from: "../../../hooks/useNetworkStatus", to: "../../../hooks" },
    { from: "../../../hooks/useTextToSpeech", to: "../../../hooks" },
    { from: "../../../hooks/useSpeechRecognition", to: "../../../hooks" },
    { from: "../../../hooks/useVirtualScroll", to: "../../../hooks" },
    { from: "../../../hooks/useIntersectionObserver", to: "../../../hooks" },
    { from: "../../../hooks/useHistory", to: "../../../hooks" },
    { from: "../../../hooks/useLocalSnapshot", to: "../../../hooks" },
    { from: "../../../hooks/useError", to: "../../../hooks" },
    { from: "../../../hooks/useErrorHandler", to: "../../../hooks" },
    { from: "../../../hooks/useTopicCheck", to: "../../../hooks" },
    { from: "../../../hooks/useTaskEvents", to: "../../../hooks" },
    { from: "../../../hooks/useSchedulerHotkeys", to: "../../../hooks" },
    { from: "../../../hooks/useGraphEditorState", to: "../../../hooks" },
  ];

  // 替换 ../../hooks/ 路径
  const replacements2 = [
    { from: "../../hooks/useTheme", to: "../../hooks" },
    { from: "../../hooks/useIsMobile", to: "../../hooks" },
    { from: "../../hooks/useSearch", to: "../../hooks" },
    { from: "../../hooks/usePerformance", to: "../../hooks" },
    { from: "../../hooks/useKeyboardShortcuts", to: "../../hooks" },
    { from: "../../hooks/useGlobalShortcuts", to: "../../hooks" },
    { from: "../../hooks/useNetworkStatus", to: "../../hooks" },
    { from: "../../hooks/useTextToSpeech", to: "../../hooks" },
    { from: "../../hooks/useSpeechRecognition", to: "../../hooks" },
    { from: "../../hooks/useVirtualScroll", to: "../../hooks" },
    { from: "../../hooks/useIntersectionObserver", to: "../../hooks" },
    { from: "../../hooks/useHistory", to: "../../hooks" },
    { from: "../../hooks/useLocalSnapshot", to: "../../hooks" },
    { from: "../../hooks/useError", to: "../../hooks" },
    { from: "../../hooks/useErrorHandler", to: "../../hooks" },
    { from: "../../hooks/useTopicCheck", to: "../../hooks" },
    { from: "../../hooks/useTaskEvents", to: "../../hooks" },
    { from: "../../hooks/useSchedulerHotkeys", to: "../../hooks" },
    { from: "../../hooks/useGraphEditorState", to: "../../hooks" },
  ];

  // 替换 ../hooks/ 路径
  const replacements3 = [
    { from: "../hooks/useTheme", to: "../hooks" },
    { from: "../hooks/useIsMobile", to: "../hooks" },
    { from: "../hooks/useSearch", to: "../hooks" },
    { from: "../hooks/usePerformance", to: "../hooks" },
    { from: "../hooks/useKeyboardShortcuts", to: "../hooks" },
    { from: "../hooks/useGlobalShortcuts", to: "../hooks" },
    { from: "../hooks/useNetworkStatus", to: "../hooks" },
    { from: "../hooks/useTextToSpeech", to: "../hooks" },
    { from: "../hooks/useSpeechRecognition", to: "../hooks" },
    { from: "../hooks/useVirtualScroll", to: "../hooks" },
    { from: "../hooks/useIntersectionObserver", to: "../hooks" },
    { from: "../hooks/useHistory", to: "../hooks" },
    { from: "../hooks/useLocalSnapshot", to: "../hooks" },
    { from: "../hooks/useError", to: "../hooks" },
    { from: "../hooks/useErrorHandler", to: "../hooks" },
    { from: "../hooks/useTopicCheck", to: "../hooks" },
    { from: "../hooks/useTaskEvents", to: "../hooks" },
    { from: "../hooks/useSchedulerHotkeys", to: "../hooks" },
    { from: "../hooks/useGraphEditorState", to: "../hooks" },
    { from: "../hooks/useScheduler", to: "../hooks" },
    { from: "../hooks/useCombinedView", to: "../hooks" },
  ];

  // 替换 ./hooks/ 路径
  const replacements4 = [
    { from: "./hooks/useTheme", to: "./hooks" },
  ];

  for (const r of replacements) {
    if (content.includes(`from "${r.from}"`) || content.includes(`from '${r.from}'`)) {
      content = content.replace(new RegExp(`from ["']${r.from}["']`, 'g'), `from "${r.to}"`);
      modified = true;
    }
  }

  for (const r of replacements2) {
    if (content.includes(`from "${r.from}"`) || content.includes(`from '${r.from}'`)) {
      content = content.replace(new RegExp(`from ["']${r.from}["']`, 'g'), `from "${r.to}"`);
      modified = true;
    }
  }

  for (const r of replacements3) {
    if (content.includes(`from "${r.from}"`) || content.includes(`from '${r.from}'`)) {
      content = content.replace(new RegExp(`from ["']${r.from}["']`, 'g'), `from "${r.to}"`);
      modified = true;
    }
  }

  for (const r of replacements4) {
    if (content.includes(`from "${r.from}"`) || content.includes(`from '${r.from}'`)) {
      content = content.replace(new RegExp(`from ["']${r.from}["']`, 'g'), `from "${r.to}"`);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      walkDir(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      processFile(filePath);
    }
  }
}

walkDir(path.join(rootDir, 'src/components'));
walkDir(path.join(rootDir, 'src/pages'));
walkDir(path.join(rootDir, 'src/three'));
processFile(path.join(rootDir, 'src/main.tsx'));

console.log('Done!');
