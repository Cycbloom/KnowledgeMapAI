/**
 * Cross-platform gradlew runner.
 * On Windows runs `gradlew.bat`, on other platforms runs `./gradlew`.
 * All arguments are passed through to gradlew.
 */
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const androidDir = resolve(__dirname, '..', 'android');
const args = process.argv.slice(2).join(' ');

const cmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

execSync(`${cmd} ${args}`, { cwd: androidDir, stdio: 'inherit' });