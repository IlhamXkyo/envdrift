import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanFileContent } from '../src/scanner.js';

test('scanFileContent: scans JavaScript and TypeScript references', () => {
  const code = `
    const port = process.env.SERVER_PORT || 4000;
    const db = process.env['DATABASE_URL'];
    const apiKey = import.meta.env.VITE_API_KEY;
    const fallback = process.env?.OPTIONAL_TOKEN;
    // process.env.IGNORED_COMMENT_VAR = 123;
  `;
  const hits = scanFileContent('app.ts', code);
  const keys = hits.map(h => h.key);

  assert.ok(keys.includes('SERVER_PORT'));
  assert.ok(keys.includes('DATABASE_URL'));
  assert.ok(keys.includes('VITE_API_KEY'));
  assert.ok(keys.includes('OPTIONAL_TOKEN'));
  assert.ok(!keys.includes('IGNORED_COMMENT_VAR'));
});

test('scanFileContent: scans Python environment lookups', () => {
  const pythonCode = `
import os
db_url = os.environ.get("REDIS_URL", "redis://localhost")
secret = os.getenv('DJANGO_SECRET_KEY')
stripe = os.environ["STRIPE_WEBHOOK_SECRET"]
# os.environ.get("COMMENTED_PYTHON_VAR")
  `;
  const hits = scanFileContent('main.py', pythonCode);
  const keys = hits.map(h => h.key);

  assert.ok(keys.includes('REDIS_URL'));
  assert.ok(keys.includes('DJANGO_SECRET_KEY'));
  assert.ok(keys.includes('STRIPE_WEBHOOK_SECRET'));
  assert.ok(!keys.includes('COMMENTED_PYTHON_VAR'));
});

test('scanFileContent: scans Go and Dockerfile definitions', () => {
  const goCode = `
    port := os.Getenv("GO_PORT")
    token, ok := os.LookupEnv("OAUTH_CLIENT_SECRET")
  `;
  const goHits = scanFileContent('server.go', goCode);
  const goKeys = goHits.map(h => h.key);

  assert.ok(goKeys.includes('GO_PORT'));
  assert.ok(goKeys.includes('OAUTH_CLIENT_SECRET'));

  const dockerfile = `
    FROM alpine
    ENV DOCKER_APP_ENV=production
    ARG BUILD_REV
  `;
  const dockerHits = scanFileContent('Dockerfile', dockerfile);
  const dockerKeys = dockerHits.map(h => h.key);

  assert.ok(dockerKeys.includes('DOCKER_APP_ENV'));
  assert.ok(dockerKeys.includes('BUILD_REV'));
});
