/**
 * Simple ANSI styling utilities with support for NO_COLOR and non-TTY environments.
 */
function createStyler(enabled = true) {
  if (!enabled || process.env.NO_COLOR) {
    return {
      bold: (s) => s,
      dim: (s) => s,
      red: (s) => s,
      green: (s) => s,
      yellow: (s) => s,
      cyan: (s) => s,
      magenta: (s) => s,
      gray: (s) => s
    };
  }

  return {
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`,
    magenta: (s) => `\x1b[35m${s}\x1b[0m`,
    gray: (s) => `\x1b[90m${s}\x1b[0m`
  };
}

/**
 * Formats terminal text output for audit results.
 *
 * @param {object} analysis
 * @param {{ noColor?: boolean }} options
 * @returns {string}
 */
export function formatReport(analysis, options = {}) {
  const c = createStyler(!options.noColor);
  const out = [];

  out.push('');
  out.push(c.bold(c.cyan('  envdrift')) + c.dim(' - Static Environment Drift & Leak Sentinel'));
  out.push(c.gray('  ------------------------------------------------------------'));

  const s = analysis.summary;
  out.push(`  Scanned Source Files : ${c.bold((s.scannedFilesCount ?? s.scannedCount).toString())}`);
  out.push(`  Variables in Code    : ${c.bold(s.scannedCount.toString())}`);
  out.push(`  Variables in Example : ${c.bold(s.exampleCount.toString())}`);
  out.push(`  Variables in Local   : ${c.bold(s.activeCount.toString())}`);
  out.push('');

  if (analysis.issues.length === 0) {
    out.push(c.green('  ✔ PASSED:') + ' All environment variables are synchronized. Zero drift detected.');
    out.push('');
    return out.join('\n');
  }

  out.push(c.bold('  Drift & Compliance Findings:'));
  out.push('');

  for (const issue of analysis.issues) {
    let tag = '';
    if (issue.severity === 'ERROR') {
      tag = c.bold(c.red('  ✖ [ERROR] '));
    } else if (issue.severity === 'WARN') {
      tag = c.bold(c.yellow('  ▲ [WARN]  '));
    } else {
      tag = c.dim(c.cyan('  ℹ [INFO]  '));
    }

    out.push(`${tag} ${c.bold(issue.key)}: ${issue.message}`);

    if (issue.occurrences && issue.occurrences.length > 0) {
      for (const occ of issue.occurrences.slice(0, 3)) {
        out.push(c.gray(`      -> ${occ.file}:${occ.line} `) + c.dim(`(${occ.snippet})`));
      }
      if (issue.occurrences.length > 3) {
        out.push(c.dim(`      -> ... and ${issue.occurrences.length - 3} more occurrences`));
      }
    }
  }

  out.push('');
  out.push(c.gray('  ------------------------------------------------------------'));

  if (analysis.valid) {
    out.push(c.green('  ✔ PASSED (with warnings):') + ` Found ${s.warnCount} warning(s) and ${s.infoCount} info message(s).`);
  } else {
    out.push(c.red('  ✖ FAILED:') + ` Found ${s.errorCount} blocking error(s) and ${s.warnCount} warning(s).`);
    out.push(c.yellow('  TIP:') + ` Run ${c.bold('envdrift sync')} to automatically scaffold missing keys into .env.example.`);
  }

  out.push('');
  return out.join('\n');
}

/**
 * Formats analysis result as structured JSON.
 *
 * @param {object} analysis
 * @returns {string}
 */
export function formatJson(analysis) {
  return JSON.stringify(analysis, null, 2);
}
