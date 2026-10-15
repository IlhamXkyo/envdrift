# envdrift

> Zero-dependency static environment variable drift detector, secret leak sentinel, and automated `.env.example` synchronizer for polyglot codebases.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/IlhamXkyo/envdrift)

---

## The Problem

Modern codebases and AI coding workflows move fast. Developers and autonomous agents constantly introduce new environment variables across JavaScript, TypeScript, Python, Go, Rust, and Dockerfiles:

```typescript
// Added during a late-night commit
const redisUrl = process.env.REDIS_CLUSTER_URL;
```

What happens next is a recurring engineering nightmare:
1. **Broken CI & Onboarding**: Developers forget to update `.env.example`. A teammate pulls `main` or CI runs, immediately crashing with cryptic `undefined` errors.
2. **Zombie Configurations**: Dead variables linger in `.env` and `.env.example` years after the code using them was refactored or deleted.
3. **Template Secret Leaks**: Authentic API keys (`ghp_...`, `sk_live_...`, AWS keys) or dangerous default credentials (`"admin"`, `"secret"`, `"123456"`) accidentally get committed into template files.
4. **Tool Bloat**: Existing linters require dozens of heavy npm packages, brittle runtime wrappers, or only work for a single language.

**`envdrift` solves this with zero dependencies and sub-second static analysis.**

---

## Features

- **Zero Dependencies**: Pure Node.js utilizing native standard library (`node:fs`, `node:path`, `node:process`). No external runtime bloat.
- **Polyglot Static Scanner**: Detects environment variables across:
  - JavaScript / TypeScript (`process.env.KEY`, `process.env['KEY']`, `process.env?.KEY`, `import.meta.env.KEY`)
  - Python (`os.environ.get('KEY')`, `os.getenv('KEY')`, `os.environ['KEY']`)
  - Go (`os.Getenv("KEY")`, `os.LookupEnv("KEY")`)
  - Rust (`env::var("KEY")`, `std::env::var("KEY")`)
  - Shell Scripts (`${KEY}`, `${KEY:-default}`)
  - Docker (`ENV KEY=...`, `ARG KEY=...`)
- **Three-Way Drift Matrix**:
  - `[ERROR]` Used in code but missing from `.env.example`.
  - `[WARN]` Declared in `.env.example` but missing from active local `.env`.
  - `[INFO]` Zombie variables present in config but unused in code.
- **Secret & Credential Sentinel**: Scans `.env.example` for high-entropy authentic keys (GitHub tokens, Stripe live keys, AWS access keys, Slack tokens, JWTs) and flags insecure trivial passwords.
- **Smart Synchronizer (`envdrift sync`)**: Automatically infers type-safe placeholders (`PORT=3000`, `DATABASE_URL=postgresql://...`, `AUTH_SECRET=your-auth-secret-here`) and appends them to `.env.example` while preserving all existing comments and formatting.
- **CI/CD Ready**: Deterministic exit codes (`0` for clean, `1` for drift/leaks) and machine-readable `--json` output for automated pipelines.

---

## Quickstart

Run directly without installing:

```bash
npx envdrift
```

Or install globally:

```bash
npm install -g envdrift
```

---

## Usage

### 1. Audit Drift & Leaks

Audit current repository for missing variables, secret leaks, and zombies:

```bash
envdrift
```

Output:
```text
  envdrift - Static Environment Drift & Leak Sentinel
  ------------------------------------------------------------
  Scanned Source Files : 42
  Variables in Code    : 14
  Variables in Example : 12
  Variables in Local   : 14

  Drift & Compliance Findings:

  ✖ [ERROR]  STRIPE_WEBHOOK_SECRET: Referenced in source code (2x) but missing from .env.example.
      -> src/billing/webhook.ts:18 (process.env.STRIPE_WEBHOOK_SECRET)
      -> src/server.ts:45 (process.env.STRIPE_WEBHOOK_SECRET)

  ℹ [INFO]   LEGACY_MAILCHIMP_KEY: Present in .env.example but not referenced in any scanned source file.

  ------------------------------------------------------------
  ✖ FAILED: Found 1 blocking error(s) and 0 warning(s).
  TIP: Run envdrift sync to automatically scaffold missing keys into .env.example.
```

### 2. Auto-Sync Missing Variables

Automatically update `.env.example` with inferred dummy placeholders:

```bash
envdrift sync
```

### 3. List All Detected Variables

Inspect every environment variable referenced in the project along with exact file locations and line numbers:

```bash
envdrift scan
```

### 4. CI/CD Integration

Fail your CI build if anyone introduces an unrecorded environment variable or commits a live secret pattern:

```yaml
# .github/workflows/ci.yml
name: Environment Compliance
on: [push, pull_request]

jobs:
  env-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Run envdrift
        run: npx envdrift check --strict
```

---

## CLI Options

| Flag | Description | Default |
| :--- | :--- | :--- |
| `check [dir]` | Audit environment variable drift and leaks | `.` |
| `sync [dir]` | Sync missing variables into `.env.example` | `.` |
| `scan [dir]` | List all detected variables with code occurrences | `.` |
| `--json` | Output machine-readable JSON for agents & CI | `false` |
| `--strict` | Exit code 1 on warnings as well as errors | `false` |
| `--ignore <vars>` | Comma-separated variable names to ignore | `NODE_ENV,PATH,...` |
| `--env-file <file>` | Path to local `.env` file | `.env` |
| `--example-file <file>` | Path to template `.env.example` file | `.env.example` |
| `--no-color` | Disable ANSI terminal colors | `false` |
| `-v, --version` | Output version | |
| `-h, --help` | Display help screen | |

---

## Programmatic API

You can also use `envdrift` directly within Node.js tools or test harnesses:

```javascript
import { check, sync, scanDirectory } from 'envdrift';

// Audit project directory
const analysis = check('./my-project', { strict: true });
if (!analysis.valid) {
  console.error(`Found ${analysis.summary.errorCount} env issues`);
}

// Synchronize missing variables
sync('./my-project');
```

---

## License

[MIT](LICENSE) © [Ilham](https://github.com/IlhamXkyo)
