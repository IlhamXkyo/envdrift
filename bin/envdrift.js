#!/usr/bin/env node

import path from 'node:path';
import { check, sync, scanDirectory, formatReport, formatJson } from '../src/index.js';

const VERSION = '1.0.0';

function printHelp() {
  console.log(`
  envdrift v${VERSION}
  Zero-dependency CLI for static environment variable drift detection and sync.

  USAGE:
    $ envdrift [command] [directory] [options]

  COMMANDS:
    check [dir]    Audit environment variable drift, leaks, and zombies (default)
    sync  [dir]    Sync missing variables into .env.example with inferred templates
    scan  [dir]    List all environment variables detected across source files

  OPTIONS:
    --json                 Output machine-readable JSON (ideal for CI/CD and AI agents)
    --strict               Fail with exit code 1 on warnings as well as errors
    --ignore <vars>        Comma-separated list of variable names to ignore
    --env-file <file>      Path to active .env file (default: .env)
    --example-file <file>  Path to template .env file (default: .env.example)
    --no-color             Disable ANSI color output
    -v, --version          Show version
    -h, --help             Show help documentation

  EXAMPLES:
    $ envdrift
    $ envdrift check src/
    $ envdrift sync
    $ envdrift --strict --json
    $ envdrift --ignore DATABASE_URL,JWT_SECRET
`);
}

function parseArgs(args) {
  const options = {
    command: 'check',
    dir: '.',
    json: false,
    strict: false,
    noColor: false,
    ignoredVars: [],
    envFile: '.env',
    exampleFile: '.env.example'
  };

  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }
    if (arg === '-v' || arg === '--version') {
      console.log(`envdrift v${VERSION}`);
      process.exit(0);
    }
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--no-color') {
      options.noColor = true;
    } else if (arg === '--ignore' && args[i + 1]) {
      options.ignoredVars = args[++i].split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg === '--env-file' && args[i + 1]) {
      options.envFile = args[++i];
    } else if (arg === '--example-file' && args[i + 1]) {
      options.exampleFile = args[++i];
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    if (['check', 'sync', 'scan'].includes(positional[0])) {
      options.command = positional[0];
      if (positional[1]) options.dir = positional[1];
    } else {
      options.dir = positional[0];
    }
  }

  return options;
}

function run() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  const targetDir = path.resolve(process.cwd(), options.dir);

  if (options.command === 'scan') {
    const scanned = scanDirectory(targetDir);
    if (options.json) {
      const output = {};
      for (const [k, v] of scanned.variables.entries()) {
        output[k] = v;
      }
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(`\n  Scanned ${scanned.scannedFilesCount} files. Found ${scanned.variables.size} unique variables:\n`);
      for (const [key, occs] of scanned.variables.entries()) {
        console.log(`  - \x1b[1m${key}\x1b[0m (${occs.length} occurrences)`);
        for (const occ of occs.slice(0, 2)) {
          console.log(`      ${occ.file}:${occ.line}`);
        }
      }
      console.log('');
    }
    process.exit(0);
  }

  if (options.command === 'sync') {
    const result = sync(targetDir, options);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (result.addedKeys.length === 0) {
        console.log('\n  ✔ .env.example is already up to date with the codebase. No changes needed.\n');
      } else {
        console.log(`\n  ✔ Synchronized ${result.addedKeys.length} missing variable(s) into ${result.filePath}:\n`);
        for (const k of result.addedKeys) {
          console.log(`    + ${k}`);
        }
        console.log('');
      }
    }
    process.exit(0);
  }

  // Default: check
  const analysis = check(targetDir, options);

  if (options.json) {
    console.log(formatJson(analysis));
  } else {
    console.log(formatReport(analysis, { noColor: options.noColor }));
  }

  if (!analysis.valid) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run();
