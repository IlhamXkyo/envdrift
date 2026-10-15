import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
  '.nyc_output',
  'vendor',
  'venv',
  '.venv',
  'env',
  '__pycache__',
  '.turbo',
  '.cache'
]);

const SUPPORTED_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.py',
  '.go',
  '.rs',
  '.sh',
  '.bash',
  '.zsh',
  '.yaml',
  '.yml'
]);

/**
 * Regex patterns tailored for each language ecosystem to detect environment variable references.
 */
const PATTERNS = [
  // JS/TS: process.env.KEY or process.env?.KEY
  {
    appliesTo: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'],
    regex: /process\.env(?:\?\.|\.)([A-Za-z_][A-Za-z0-9_]*)/g,
    group: 1
  },
  // JS/TS: process.env['KEY'] or process.env["KEY"]
  {
    appliesTo: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'],
    regex: /process\.env\s*(?:\?\.)?\s*\[\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]\s*\]/g,
    group: 1
  },
  // JS/TS: import.meta.env.KEY or import.meta.env['KEY']
  {
    appliesTo: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'],
    regex: /import\.meta\.env(?:\?\.|\.)([A-Za-z_][A-Za-z0-9_]*)/g,
    group: 1
  },
  {
    appliesTo: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'],
    regex: /import\.meta\.env\s*(?:\?\.)?\s*\[\s*['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]\s*\]/g,
    group: 1
  },
  // Python: os.environ.get('KEY') or os.getenv('KEY') or os.environ['KEY']
  {
    appliesTo: ['.py'],
    regex: /(?:os\.)?(?:environ(?:\.get)?|getenv)\s*\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g,
    group: 1
  },
  {
    appliesTo: ['.py'],
    regex: /(?:os\.)?environ\s*\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g,
    group: 1
  },
  // Go: os.Getenv("KEY") or os.LookupEnv("KEY")
  {
    appliesTo: ['.go'],
    regex: /os\.(?:Getenv|LookupEnv)\s*\(\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)/g,
    group: 1
  },
  // Rust: env::var("KEY") or std::env::var("KEY")
  {
    appliesTo: ['.rs'],
    regex: /(?:std::)?env::var\s*\(\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)/g,
    group: 1
  },
  // Shell / Docker Compose: ${KEY} or ${KEY:-default} or $KEY
  {
    appliesTo: ['.sh', '.bash', '.zsh', '.yaml', '.yml', 'dockerfile'],
    regex: /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-.*?)?\}/g,
    group: 1
  }
];

// Special Dockerfile instructions
const DOCKER_ENV_ARG_REGEX = /^\s*(?:ENV|ARG)\s+([A-Za-z_][A-Za-z0-9_]*)(?:=|\s|$)/;

/**
 * Checks if a line is a full single-line comment in supported languages.
 */
function isCommentLine(line, ext) {
  const trimmed = line.trim();
  if (!trimmed) return true;

  if (ext === '.py' || ext === '.sh' || ext === '.bash' || ext === '.zsh' || ext === '.yaml' || ext === '.yml') {
    return trimmed.startsWith('#');
  }

  if (ext === '.rs' || ext === '.go' || ext.startsWith('.js') || ext.startsWith('.ts') || ext.startsWith('.m') || ext.startsWith('.c')) {
    return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
  }

  return false;
}

/**
 * Recursively collects candidate files from the target directory.
 *
 * @param {string} dir
 * @param {Set<string>} customIgnoredDirs
 * @returns {string[]}
 */
export function collectFiles(dir, customIgnoredDirs = new Set()) {
  const files = [];
  const ignored = new Set([...DEFAULT_IGNORED_DIRS, ...customIgnoredDirs]);

  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env.example' && entry.name !== '.env') {
        if (entry.isDirectory()) continue;
      }

      if (entry.isDirectory()) {
        if (!ignored.has(entry.name)) {
          walk(path.join(current, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const base = entry.name.toLowerCase();

        if (
          SUPPORTED_EXTENSIONS.has(ext) ||
          base === 'dockerfile' ||
          base.startsWith('dockerfile.')
        ) {
          files.push(path.join(current, entry.name));
        }
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Scans a single file content for environment variable references.
 *
 * @param {string} filePath
 * @param {string} content
 * @returns {Array<{ key: string, line: number, snippet: string }>}
 */
export function scanFileContent(filePath, content) {
  const ext = path.extname(filePath).toLowerCase();
  const isDocker = path.basename(filePath).toLowerCase().startsWith('dockerfile');
  const lines = content.split(/\r?\n/);
  const found = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];

    if (isCommentLine(rawLine, ext)) {
      continue;
    }

    // Dockerfile specific instruction check
    if (isDocker) {
      const match = rawLine.match(DOCKER_ENV_ARG_REGEX);
      if (match) {
        found.push({
          key: match[1],
          line: lineIdx + 1,
          snippet: rawLine.trim()
        });
      }
    }

    // General pattern matching
    for (const pattern of PATTERNS) {
      if (pattern.appliesTo) {
        const matchesExt = pattern.appliesTo.includes(ext) || (isDocker && pattern.appliesTo.includes('dockerfile'));
        if (!matchesExt) continue;
      }

      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(rawLine)) !== null) {
        const key = match[pattern.group];
        if (key && key.length > 1) {
          found.push({
            key,
            line: lineIdx + 1,
            snippet: rawLine.trim()
          });
        }
      }
    }
  }

  return found;
}

/**
 * Scans a directory and aggregates all referenced environment variables.
 *
 * @param {string} rootDir
 * @param {object} options
 * @returns {{
 *   variables: Map<string, Array<{ file: string, line: number, snippet: string }>>,
 *   scannedFilesCount: number
 * }}
 */
export function scanDirectory(rootDir, options = {}) {
  const files = collectFiles(rootDir, options.ignoredDirs);
  const variables = new Map();

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const hits = scanFileContent(file, content);
    const relPath = path.relative(rootDir, file).replace(/\\/g, '/');

    for (const hit of hits) {
      if (!variables.has(hit.key)) {
        variables.set(hit.key, []);
      }
      variables.get(hit.key).push({
        file: relPath,
        line: hit.line,
        snippet: hit.snippet
      });
    }
  }

  return {
    variables,
    scannedFilesCount: files.length
  };
}
