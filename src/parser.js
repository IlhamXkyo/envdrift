import fs from 'node:fs';

/**
 * Parses .env file contents into structured data preserving lines, comments, and values.
 *
 * @param {string} content
 * @returns {{
 *   vars: Record<string, string>,
 *   lines: Array<{
 *     type: 'variable' | 'comment' | 'empty',
 *     key?: string,
 *     value?: string,
 *     raw: string,
 *     comment?: string,
 *     quote?: string
 *   }>
 * }}
 */
export function parseEnv(content) {
  const lines = content.split(/\r?\n/);
  const vars = {};
  const parsedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      parsedLines.push({ type: 'empty', raw });
      continue;
    }

    if (trimmed.startsWith('#')) {
      parsedLines.push({
        type: 'comment',
        raw,
        comment: trimmed.slice(1).trim()
      });
      continue;
    }

    // Match KEY=VALUE or export KEY=VALUE
    const match = raw.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      parsedLines.push({ type: 'comment', raw });
      continue;
    }

    const key = match[1];
    let valPart = match[2];
    let quote = '';
    let val = '';
    let comment = '';

    // Check for quotes
    if (valPart.startsWith('"')) {
      quote = '"';
      const endQuoteIndex = valPart.indexOf('"', 1);
      if (endQuoteIndex !== -1) {
        val = valPart.slice(1, endQuoteIndex);
        const remainder = valPart.slice(endQuoteIndex + 1).trim();
        if (remainder.startsWith('#')) {
          comment = remainder.slice(1).trim();
        }
      } else {
        val = valPart.slice(1);
      }
    } else if (valPart.startsWith("'")) {
      quote = "'";
      const endQuoteIndex = valPart.indexOf("'", 1);
      if (endQuoteIndex !== -1) {
        val = valPart.slice(1, endQuoteIndex);
        const remainder = valPart.slice(endQuoteIndex + 1).trim();
        if (remainder.startsWith('#')) {
          comment = remainder.slice(1).trim();
        }
      } else {
        val = valPart.slice(1);
      }
    } else {
      // Unquoted, handle inline comment: FOO=bar # comment
      const commentIndex = valPart.indexOf('#');
      if (commentIndex !== -1) {
        val = valPart.slice(0, commentIndex).trim();
        comment = valPart.slice(commentIndex + 1).trim();
      } else {
        val = valPart.trim();
      }
    }

    vars[key] = val;
    parsedLines.push({
      type: 'variable',
      key,
      value: val,
      raw,
      comment,
      quote
    });
  }

  return { vars, lines: parsedLines };
}

/**
 * Loads and parses an environment file from disk if it exists.
 *
 * @param {string} filePath
 * @returns {{ exists: boolean, vars: Record<string, string>, lines: Array<any> }}
 */
export function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, vars: {}, lines: [] };
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = parseEnv(content);
  return { exists: true, ...parsed };
}
