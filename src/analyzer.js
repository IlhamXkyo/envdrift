/**
 * Built-in system or runtime environment variables that are safe to ignore by default.
 */
const DEFAULT_IGNORED_VARS = new Set([
  'NODE_ENV',
  'PATH',
  'PORT', // Sometimes standard default, but still can be tracked if user removes ignore
  'HOME',
  'USER',
  'SHELL',
  'PWD',
  'CI'
]);

/**
 * Secret leak signatures for public files like .env.example
 */
const SECRET_SIGNATURES = [
  { name: 'GitHub Personal Access Token', regex: /^gh[pousr]_[A-Za-z0-9_]{36,255}$/ },
  { name: 'Stripe Secret Key', regex: /^sk_(?:live|test)_[0-9a-zA-Z]{24,}$/ },
  { name: 'AWS Access Key ID', regex: /^AKIA[0-9A-Z]{16}$/ },
  { name: 'Slack Token', regex: /^xox[baprs]-[0-9a-zA-Z]{10,48}$/ },
  { name: 'Google API Key', regex: /^AIza[0-9A-Za-z-_]{35}$/ },
  { name: 'JSON Web Token (JWT)', regex: /^eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/ }
];

const TRIVIAL_PASSWORDS = new Set([
  '123456',
  'password',
  'secret',
  'admin',
  'root',
  'test',
  'qwerty',
  'changeme',
  '12345678'
]);

/**
 * Analyzes environment variable drift, security leaks, and unused zombies.
 *
 * @param {{
 *   scanned: { variables: Map<string, Array<{ file: string, line: number, snippet: string }>>, scannedFilesCount: number },
 *   example: { exists: boolean, vars: Record<string, string>, lines: Array<any> },
 *   active: { exists: boolean, vars: Record<string, string>, lines: Array<any> },
 *   options?: { ignoredVars?: string[], strict?: boolean }
 * }} param0
 * @returns {{
 *   valid: boolean,
 *   summary: {
 *     scannedCount: number,
 *     exampleCount: number,
 *     activeCount: number,
 *     errorCount: number,
 *     warnCount: number,
 *     infoCount: number
 *   },
 *   issues: Array<{
 *     type: 'MISSING_IN_EXAMPLE' | 'MISSING_IN_ACTIVE' | 'ZOMBIE_VARIABLE' | 'SECRET_LEAK' | 'INSECURE_DEFAULT' | 'TYPE_MISMATCH',
 *     severity: 'ERROR' | 'WARN' | 'INFO',
 *     key: string,
 *     message: string,
 *     file?: string,
 *     occurrences?: Array<{ file: string, line: number, snippet: string }>
 *   }>
 * }}
 */
export function analyzeEnvironment({ scanned, example, active, options = {} }) {
  const ignored = new Set([
    ...DEFAULT_IGNORED_VARS,
    ...(options.ignoredVars || [])
  ]);

  const issues = [];
  const scannedKeys = new Set(scanned.variables.keys());
  const exampleKeys = new Set(Object.keys(example.vars));
  const activeKeys = new Set(Object.keys(active.vars));

  // 1. Check for variables used in code but missing in .env.example
  for (const [key, occurrences] of scanned.variables.entries()) {
    if (ignored.has(key)) continue;

    if (example.exists && !exampleKeys.has(key)) {
      issues.push({
        type: 'MISSING_IN_EXAMPLE',
        severity: 'ERROR',
        key,
        message: `Referenced in source code (${occurrences.length}x) but missing from .env.example.`,
        occurrences
      });
    }
  }

  // 2. Check for variables in .env.example missing in active .env
  if (example.exists && active.exists) {
    for (const key of exampleKeys) {
      if (ignored.has(key)) continue;

      if (!activeKeys.has(key)) {
        issues.push({
          type: 'MISSING_IN_ACTIVE',
          severity: 'WARN',
          key,
          message: 'Declared in .env.example but not configured in local .env.'
        });
      }
    }
  }

  // 3. Check for zombie variables (declared in .env.example or .env but never referenced in code)
  if (example.exists) {
    for (const key of exampleKeys) {
      if (ignored.has(key)) continue;

      if (!scannedKeys.has(key)) {
        issues.push({
          type: 'ZOMBIE_VARIABLE',
          severity: 'INFO',
          key,
          message: 'Present in .env.example but not referenced in any scanned source file.'
        });
      }
    }
  }

  // 4. Secret leak analysis in .env.example
  if (example.exists) {
    for (const [key, val] of Object.entries(example.vars)) {
      if (!val || val.length < 8) continue;

      for (const sig of SECRET_SIGNATURES) {
        if (sig.regex.test(val)) {
          issues.push({
            type: 'SECRET_LEAK',
            severity: 'ERROR',
            key,
            message: `Actual ${sig.name} detected in .env.example! Replace with dummy placeholder.`
          });
          break;
        }
      }

      // High entropy detector for keys labeled SECRET/KEY/TOKEN
      const isSensitiveKey = /SECRET|TOKEN|KEY|PRIVATE|PASSWORD/i.test(key);
      if (isSensitiveKey) {
        const lowerVal = val.toLowerCase();
        if (TRIVIAL_PASSWORDS.has(lowerVal)) {
          issues.push({
            type: 'INSECURE_DEFAULT',
            severity: 'WARN',
            key,
            message: `Sensitive variable uses insecure trivial default "${val}".`
          });
        }
      }
    }
  }

  // 5. Type & format heuristics
  const checkVars = { ...example.vars, ...active.vars };
  for (const [key, val] of Object.entries(checkVars)) {
    if (!val || val.startsWith('your-') || val.startsWith('<') || val.startsWith('dummy')) {
      continue;
    }

    // Port check: PORT or *_PORT
    if (key === 'PORT' || key.endsWith('_PORT')) {
      const portNum = Number(val);
      if (isNaN(portNum) || !Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        issues.push({
          type: 'TYPE_MISMATCH',
          severity: 'WARN',
          key,
          message: `Expected integer port (1-65535), received "${val}".`
        });
      }
    }

    // URL check: *_URL or *_URI
    if (key.endsWith('_URL') || key.endsWith('_URI')) {
      const isPlaceholder = val.includes('localhost') || val.includes('example.com') || val.includes('dummy');
      if (!isPlaceholder && !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(val)) {
        issues.push({
          type: 'TYPE_MISMATCH',
          severity: 'WARN',
          key,
          message: `Expected valid URI schema (e.g. https://, postgres://), received "${val}".`
        });
      }
    }
  }

  const errorCount = issues.filter(i => i.severity === 'ERROR').length;
  const warnCount = issues.filter(i => i.severity === 'WARN').length;
  const infoCount = issues.filter(i => i.severity === 'INFO').length;

  const valid = options.strict ? (errorCount === 0 && warnCount === 0) : (errorCount === 0);

  return {
    valid,
    summary: {
      scannedFilesCount: scanned.scannedFilesCount || 0,
      scannedCount: scanned.variables.size,
      exampleCount: Object.keys(example.vars).length,
      activeCount: Object.keys(active.vars).length,
      errorCount,
      warnCount,
      infoCount
    },
    issues
  };
}
