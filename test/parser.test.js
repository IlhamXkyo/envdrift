import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from '../src/parser.js';

test('parseEnv: parses basic key-value pairs', () => {
  const content = `
PORT=3000
HOST=127.0.0.1
DEBUG=true
`;
  const { vars } = parseEnv(content);
  assert.equal(vars.PORT, '3000');
  assert.equal(vars.HOST, '127.0.0.1');
  assert.equal(vars.DEBUG, 'true');
});

test('parseEnv: handles export prefix and quotes', () => {
  const content = `
export DATABASE_URL="postgresql://user:pass@localhost:5432/db"
export API_KEY='secret_key_123'
EMPTY_VAL=
`;
  const { vars } = parseEnv(content);
  assert.equal(vars.DATABASE_URL, 'postgresql://user:pass@localhost:5432/db');
  assert.equal(vars.API_KEY, 'secret_key_123');
  assert.equal(vars.EMPTY_VAL, '');
});

test('parseEnv: preserves comments and inline comments', () => {
  const content = `
# System configuration
PORT=8080 # Server port
JWT_SECRET="topsecret" # Auth token
`;
  const { vars, lines } = parseEnv(content);
  assert.equal(vars.PORT, '8080');
  assert.equal(vars.JWT_SECRET, 'topsecret');

  const commentLine = lines.find(l => l.type === 'comment');
  assert.ok(commentLine);
  assert.equal(commentLine.comment, 'System configuration');

  const portLine = lines.find(l => l.key === 'PORT');
  assert.equal(portLine.comment, 'Server port');
});
