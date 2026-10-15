import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeEnvironment } from '../src/analyzer.js';

test('analyzeEnvironment: flags missing variables in .env.example as ERROR', () => {
  const scanned = {
    variables: new Map([
      ['DATABASE_URL', [{ file: 'src/db.ts', line: 10, snippet: 'process.env.DATABASE_URL' }]],
      ['JWT_SECRET', [{ file: 'src/auth.ts', line: 15, snippet: 'process.env.JWT_SECRET' }]]
    ]),
    scannedFilesCount: 2
  };

  const example = {
    exists: true,
    vars: {
      DATABASE_URL: 'postgresql://localhost:5432'
    },
    lines: []
  };

  const active = {
    exists: true,
    vars: {
      DATABASE_URL: 'postgresql://localhost:5432',
      JWT_SECRET: 'local_secret'
    },
    lines: []
  };

  const result = analyzeEnvironment({ scanned, example, active });
  assert.equal(result.valid, false);
  assert.equal(result.summary.errorCount, 1);

  const missingIssue = result.issues.find(i => i.type === 'MISSING_IN_EXAMPLE');
  assert.ok(missingIssue);
  assert.equal(missingIssue.key, 'JWT_SECRET');
  assert.equal(missingIssue.severity, 'ERROR');
});

test('analyzeEnvironment: flags zombie variables as INFO', () => {
  const scanned = {
    variables: new Map([
      ['ACTIVE_VAR', [{ file: 'src/app.ts', line: 5, snippet: 'process.env.ACTIVE_VAR' }]]
    ]),
    scannedFilesCount: 1
  };

  const example = {
    exists: true,
    vars: {
      ACTIVE_VAR: 'value1',
      DEAD_LEGACY_KEY: 'deprecated'
    },
    lines: []
  };

  const active = { exists: false, vars: {}, lines: [] };

  const result = analyzeEnvironment({ scanned, example, active });
  const zombieIssue = result.issues.find(i => i.type === 'ZOMBIE_VARIABLE');
  assert.ok(zombieIssue);
  assert.equal(zombieIssue.key, 'DEAD_LEGACY_KEY');
  assert.equal(zombieIssue.severity, 'INFO');
});

test('analyzeEnvironment: flags GitHub tokens and secret leaks in .env.example', () => {
  const scanned = { variables: new Map(), scannedFilesCount: 0 };
  const example = {
    exists: true,
    vars: {
      GITHUB_TOKEN: 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
    },
    lines: []
  };
  const active = { exists: false, vars: {}, lines: [] };

  const result = analyzeEnvironment({ scanned, example, active });
  const leak = result.issues.find(i => i.type === 'SECRET_LEAK');
  assert.ok(leak);
  assert.equal(leak.severity, 'ERROR');
});

test('analyzeEnvironment: flags invalid port numbers', () => {
  const scanned = { variables: new Map(), scannedFilesCount: 0 };
  const example = {
    exists: true,
    vars: {
      APP_PORT: 'invalid_port_string'
    },
    lines: []
  };
  const active = { exists: false, vars: {}, lines: [] };

  const result = analyzeEnvironment({ scanned, example, active });
  const typeIssue = result.issues.find(i => i.type === 'TYPE_MISMATCH');
  assert.ok(typeIssue);
  assert.equal(typeIssue.key, 'APP_PORT');
});
