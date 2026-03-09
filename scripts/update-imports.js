import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filesToUpdate = [
  'src/components/Scheduler/ActiveTaskPanel.tsx',
  'src/components/Scheduler/DailyReview.tsx',
  'src/components/Scheduler/DailyStats.tsx',
  'src/components/Scheduler/DependencyGraph.tsx',
  'src/components/Scheduler/DraggableTaskCard.tsx',
  'src/components/Scheduler/EfficiencyTrend.tsx',
  'src/components/Scheduler/FocusHeatmap.tsx',
  'src/components/Scheduler/HorizontalQueue.tsx',
  'src/components/Scheduler/HorizontalQueueView.tsx',
  'src/components/Scheduler/KanbanView.tsx',
  'src/components/Scheduler/ListView.tsx',
  'src/components/Scheduler/MonthlyReport.tsx',
  'src/components/Scheduler/PomodoroSettings.tsx',
  'src/components/Scheduler/QueueColumn.tsx',
  'src/components/Scheduler/SmartRecommendationBar.tsx',
  'src/components/Scheduler/SmartSuggestion.tsx',
  'src/components/Scheduler/TaskCard.tsx',
  'src/components/Scheduler/TaskDetail.tsx',
  'src/components/Scheduler/TaskDistribution.tsx',
  'src/components/Scheduler/TaskForm.tsx',
  'src/components/Scheduler/TaskRecommendation.tsx',
  'src/components/Scheduler/TaskRetrospect.tsx',
  'src/components/Scheduler/TimeAnalysis.tsx',
  'src/components/Scheduler/TimelineView.tsx',
  'src/components/Scheduler/TimeSlotSettings.tsx',
  'src/components/Scheduler/WeeklyReflection.tsx',
  'src/components/Scheduler/WeeklyReport.tsx',
  'src/components/Statistics/TaskStatsTab.tsx',
  'src/services/api/taskRecommendation.ts',
  'src/components/Scheduler/TaskWorkbench/ExecutionRecords.tsx',
  'src/components/Scheduler/TaskWorkbench/KnowledgePointAssociation.tsx',
  'src/components/Scheduler/TaskWorkbench/ProgressDetail.tsx',
  'src/components/Scheduler/TaskWorkbench/SubtaskList.tsx',
  'src/components/Scheduler/TaskWorkbench/TaskLinks.tsx',
  'src/components/Scheduler/TaskWorkbench/TaskWorkbench.tsx',
];

function updateFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  const oldImports = [
    /from ['"]\.\.?\/services\/api\/scheduler['"]/g,
    /from ['"]\.\.\/\.\.\/services\/api\/scheduler['"]/g,
    /from ['"]\.\.\/services\/api\/scheduler['"]/g,
  ];

  for (const pattern of oldImports) {
    if (pattern.test(content)) {
      console.log(`Updating imports in: ${filePath}`);
      
      if (content.includes('schedulerApi')) {
        content = content.replace(
          /import\s*{([^}]*?)schedulerApi([^}]*?)}\s*from\s*['"][^'"]*scheduler['"]/g,
          "import { api } from '../../services/api';\nimport type {$1$2} from '@shared/types'"
        );
        content = content.replace(/schedulerApi\./g, 'api.scheduler.');
      } else {
        content = content.replace(
          /from\s*['"][^'"]*scheduler['"]/g,
          "from '@shared/types'"
        );
      }
      
      modified = true;
      break;
    }
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

console.log('Starting import update...\n');

filesToUpdate.forEach(updateFile);

console.log('\nDone!');
