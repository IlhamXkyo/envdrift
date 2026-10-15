import path from 'node:path';
import { scanDirectory } from './scanner.js';
import { loadEnvFile, parseEnv } from './parser.js';
import { analyzeEnvironment } from './analyzer.js';
import { syncExampleContent, syncExampleFile } from './syncer.js';
import { formatReport, formatJson } from './reporter.js';

/**
 * Runs a complete environment drift audit on a given directory.
 *
 * @param {string} rootDir
 * @param {object} options
 * @returns {object} Analysis result
 */
export function check(rootDir = process.cwd(), options = {}) {
  const exampleFile = path.resolve(rootDir, options.exampleFile || '.env.example');
  const activeFile = path.resolve(rootDir, options.envFile || '.env');

  const scanned = scanDirectory(rootDir, {
    ignoredDirs: options.ignoredDirs
  });

  const example = loadEnvFile(exampleFile);
  const active = loadEnvFile(activeFile);

  const analysis = analyzeEnvironment({
    scanned,
    example,
    active,
    options
  });

  return analysis;
}

/**
 * Synchronizes missing variables in a target directory into its .env.example file.
 *
 * @param {string} rootDir
 * @param {object} options
 * @returns {{ addedKeys: string[], filePath: string }}
 */
export function sync(rootDir = process.cwd(), options = {}) {
  const exampleFile = path.resolve(rootDir, options.exampleFile || '.env.example');
  const scanned = scanDirectory(rootDir, {
    ignoredDirs: options.ignoredDirs
  });

  const example = loadEnvFile(exampleFile);
  const missingKeys = [];

  for (const key of scanned.variables.keys()) {
    if (options.ignoredVars && options.ignoredVars.includes(key)) {
      continue;
    }
    if (!example.vars[key]) {
      missingKeys.push(key);
    }
  }

  const result = syncExampleFile(exampleFile, missingKeys);
  return result;
}

export {
  scanDirectory,
  loadEnvFile,
  parseEnv,
  analyzeEnvironment,
  syncExampleContent,
  syncExampleFile,
  formatReport,
  formatJson
};
