import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferPlaceholder, syncExampleContent } from '../src/syncer.js';

test('inferPlaceholder: infers sensible placeholders based on variable name', () => {
  assert.equal(inferPlaceholder('APP_PORT'), '3000');
  assert.equal(inferPlaceholder('DATABASE_URL'), 'postgresql://postgres:postgres@localhost:5432/app_db');
  assert.equal(inferPlaceholder('REDIS_HOST'), 'redis://localhost:6379');
  assert.equal(inferPlaceholder('STRIPE_API_KEY'), 'your-stripe-api-key-here');
  assert.equal(inferPlaceholder('ENABLE_BETA_FEATURES'), 'false');
});

test('syncExampleContent: appends missing variables preserving existing content', () => {
  const existing = `# Existing config
PORT=8000
DATABASE_URL=postgresql://localhost:5432/dev
`;

  const missing = ['JWT_SECRET', 'REDIS_URL'];
  const { content, addedCount } = syncExampleContent(existing, missing);

  assert.equal(addedCount, 2);
  assert.ok(content.includes('PORT=8000'));
  assert.ok(content.includes('# Existing config'));
  assert.ok(content.includes('JWT_SECRET=your-jwt-secret-here'));
  assert.ok(content.includes('REDIS_URL=redis://localhost:6379'));
});
