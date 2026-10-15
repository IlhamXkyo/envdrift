import fs from 'node:fs';

/**
 * Infers an appropriate, secure placeholder value for an environment variable based on standard naming conventions.
 *
 * @param {string} key
 * @returns {string}
 */
export function inferPlaceholder(key) {
  const upper = key.toUpperCase();

  if (upper === 'PORT' || upper.endsWith('_PORT')) {
    return '3000';
  }
  if (upper.includes('DATABASE_URL') || upper.includes('DB_URI') || upper.includes('POSTGRES')) {
    return 'postgresql://postgres:postgres@localhost:5432/app_db';
  }
  if (upper.includes('MONGO')) {
    return 'mongodb://localhost:27017/app_db';
  }
  if (upper.includes('REDIS')) {
    return 'redis://localhost:6379';
  }
  if (upper.endsWith('_URL') || upper.endsWith('_URI') || upper.endsWith('_ENDPOINT')) {
    return 'http://localhost:3000';
  }
  if (upper.endsWith('_KEY') || upper.endsWith('_SECRET') || upper.endsWith('_TOKEN') || upper.includes('API_KEY')) {
    return `your-${key.toLowerCase().replace(/_/g, '-')}-here`;
  }
  if (upper.endsWith('_ENABLED') || upper.endsWith('_DEBUG') || upper.startsWith('IS_') || upper.startsWith('ENABLE_')) {
    return 'false';
  }
  if (upper.includes('EMAIL') || upper.includes('MAIL')) {
    return 'noreply@example.com';
  }

  return `your-${key.toLowerCase().replace(/_/g, '-')}`;
}

/**
 * Synchronizes missing variables into .env.example content while preserving all existing lines and structure.
 *
 * @param {string} currentContent
 * @param {string[]} missingKeys
 * @returns {{ content: string, addedCount: number }}
 */
export function syncExampleContent(currentContent, missingKeys) {
  if (!missingKeys || missingKeys.length === 0) {
    return { content: currentContent, addedCount: 0 };
  }

  const lines = currentContent ? currentContent.split(/\r?\n/) : [];

  // Remove trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  if (lines.length > 0) {
    lines.push('');
  }

  lines.push('# -----------------------------------------------------------------------------');
  lines.push('# Inferred by envdrift (Codebase Synchronized)');
  lines.push('# -----------------------------------------------------------------------------');

  for (const key of missingKeys) {
    const placeholder = inferPlaceholder(key);
    lines.push(`${key}=${placeholder}`);
  }

  lines.push(''); // Trailing newline
  return {
    content: lines.join('\n'),
    addedCount: missingKeys.length
  };
}

/**
 * Synchronizes the example file on disk.
 *
 * @param {string} exampleFilePath
 * @param {string[]} missingKeys
 * @returns {{ success: boolean, addedKeys: string[], filePath: string }}
 */
export function syncExampleFile(exampleFilePath, missingKeys) {
  let existing = '';
  if (fs.existsSync(exampleFilePath)) {
    existing = fs.readFileSync(exampleFilePath, 'utf8');
  }

  const { content, addedCount } = syncExampleContent(existing, missingKeys);
  fs.writeFileSync(exampleFilePath, content, 'utf8');

  return {
    success: true,
    addedKeys: missingKeys,
    filePath: exampleFilePath
  };
}
