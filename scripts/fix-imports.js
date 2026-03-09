import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filesToFix = [
  'src/components/Scheduler/DailyStats.tsx',
  'src/components/Scheduler/EfficiencyTrend.tsx',
  'src/components/Scheduler/FocusHeatmap.tsx',
  'src/components/Scheduler/MonthlyReport.tsx',
  'src/components/Scheduler/PomodoroSettings.tsx',
  'src/components/Scheduler/SmartRecommendationBar.tsx',
  'src/components/Scheduler/TaskDistribution.tsx',
  'src/components/Scheduler/TaskForm.tsx',
  'src/components/Scheduler/TimeAnalysis.tsx',
  'src/components/Scheduler/TimeSlotSettings.tsx',
  'src/components/Scheduler/WeeklyReflection.tsx',
  'src/components/Scheduler/WeeklyReport.tsx',
  'src/components/Statistics/TaskStatsTab.tsx',
  'src/components/Scheduler/TaskWorkbench/ExecutionRecords.tsx',
  'src/components/Scheduler/TaskWorkbench/KnowledgePointAssociation.tsx',
  'src/components/Scheduler/TaskWorkbench/ProgressDetail.tsx',
  'src/components/Scheduler/TaskWorkbench/SubtaskList.tsx',
  'src/components/Scheduler/TaskWorkbench/TaskLinks.tsx',
  'src/components/Scheduler/TaskWorkbench/TaskWorkbench.tsx',
  'src/services/api/taskRecommendation.ts',
];

function fixFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  const schedulerApiImportRegex = /import\s*{([^}]*?)schedulerApi([^}]*?)}\s*from\s*['"]@shared\/types['"]/g;
  if (schedulerApiImportRegex.test(content)) {
    console.log(`Fixing schedulerApi import in: ${filePath}`);
    
    content = content.replace(
      schedulerApiImportRegex,
      (match, before, after) => {
        const typesPart = (before + after).trim().replace(/^,\s*|,\s*$/g, '');
        if (typesPart) {
          return `import { api } from '../../services/api';\nimport type {${typesPart}} from '@shared/types'`;
        }
        return `import { api } from '../../services/api'`;
      }
    );
    
    content = content.replace(/schedulerApi\./g, 'api.scheduler.');
    modified = true;
  }

  const schedulerImportRegex = /import\s*{([^}]*?)}\s*from\s*['"]\.\.?\/services\/api\/scheduler['"]/g;
  if (schedulerImportRegex.test(content)) {
    console.log(`Fixing scheduler import in: ${filePath}`);
    content = content.replace(
      schedulerImportRegex,
      (match, types) => {
        if (types.includes('schedulerApi')) {
          const cleanTypes = types.replace(/schedulerApi,?\s*/g, '').trim().replace(/^,\s*|,\s*$/g, '');
          if (cleanTypes) {
            return `import { api } from '../../services/api';\nimport type {${cleanTypes}} from '@shared/types'`;
          }
          return `import { api } from '../../services/api'`;
        }
        return `import type {${types}} from '@shared/types'`;
      }
    );
    content = content.replace(/schedulerApi\./g, 'api.scheduler.');
    modified = true;
  }

  if (filePath.includes('taskRecommendation.ts')) {
    content = content.replace(
      /import\s*{([^}]*?)}\s*from\s*['"]\.\/scheduler['"]/g,
      'import type {$1} from \'@shared/types\''
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

console.log('Starting import fix...\n');

filesToFix.forEach(fixFile);

console.log('\nDone!');
