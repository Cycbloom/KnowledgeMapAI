#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const cacheDir = join(rootDir, 'node_modules', '.cache');

if (!existsSync(cacheDir)) {
  mkdirSync(cacheDir, { recursive: true });
}

function getChangedFiles(extension) {
  try {
    const stagedFiles = execSync(
      'git diff --cached --name-only --diff-filter=ACMR -- "*.ts" "*.tsx"',
      { encoding: 'utf-8', cwd: rootDir }
    ).trim();

    const unstagedFiles = execSync(
      'git diff --name-only --diff-filter=ACMR -- "*.ts" "*.tsx"',
      { encoding: 'utf-8', cwd: rootDir }
    ).trim();

    const allFiles = [...new Set([
      ...stagedFiles.split('\n').filter(Boolean),
      ...unstagedFiles.split('\n').filter(Boolean)
    ])];

    return allFiles.filter(file => file.endsWith(extension));
  } catch (error) {
    console.log('Not a git repository or no changes detected, running full check...');
    return [];
  }
}

function runTypeCheck(files) {
  if (files.length === 0) {
    console.log('📝 Running full type check...');
    try {
      execSync('npx tsc --noEmit', {
        stdio: 'inherit',
        cwd: rootDir
      });
      console.log('✅ Type check passed!');
      return true;
    } catch {
      return false;
    }
  }

  console.log(`📝 Running incremental type check on ${files.length} files...`);

  const tempTsconfig = {
    extends: './tsconfig.json',
    include: files,
    compilerOptions: {
      noEmit: true,
      incremental: false
    }
  };

  const tempConfigPath = join(cacheDir, 'tsconfig.incremental.json');
  writeFileSync(tempConfigPath, JSON.stringify(tempTsconfig, null, 2));

  try {
    execSync(`npx tsc -p ${tempConfigPath}`, {
      stdio: 'inherit',
      cwd: rootDir
    });
    console.log('✅ Type check passed!');
    return true;
  } catch {
    return false;
  }
}

function runLint(files) {
  if (files.length === 0) {
    console.log('🔍 Running full lint...');
    try {
      execSync('npx eslint . --cache --cache-location node_modules/.cache/eslint --quiet', {
        stdio: 'inherit',
        cwd: rootDir
      });
      console.log('✅ Lint passed!');
      return true;
    } catch {
      return false;
    }
  }

  console.log(`🔍 Running incremental lint on ${files.length} files...`);

  const filteredFiles = files.filter(f =>
    !f.includes('.test.') &&
    !f.includes('__tests__') &&
    !f.includes('e2e/')
  );

  if (filteredFiles.length === 0) {
    console.log('✅ No files to lint!');
    return true;
  }

  try {
    execSync(
      `npx eslint ${filteredFiles.join(' ')} --cache --cache-location node_modules/.cache/eslint --quiet`,
      {
        stdio: 'inherit',
        cwd: rootDir
      }
    );
    console.log('✅ Lint passed!');
    return true;
  } catch {
    return false;
  }
}

const args = process.argv.slice(2);
const forceFull = args.includes('--full');

console.log('🚀 Running incremental checks...\n');

const changedFiles = forceFull ? [] : getChangedFiles('.ts');
const changedTsxFiles = forceFull ? [] : getChangedFiles('.tsx');
const allChangedFiles = [...changedFiles, ...changedTsxFiles];

const typeCheckPassed = runTypeCheck(allChangedFiles);
const lintPassed = runLint(allChangedFiles);

if (!typeCheckPassed || !lintPassed) {
  process.exit(1);
}

console.log('\n🎉 All checks passed!');
