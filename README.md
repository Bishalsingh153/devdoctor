# devdoctor

CLI for scanning, explaining, and fixing developer environment issues.

The npm package is **`@bishalsingh/devdoctor`**. After it is installed, the command on your PATH is still **`devdoctor`** (from the package `bin` field). `npx` must use the scoped package name; a global install does not.

`devdoctor scan` runs checks against the current project and writes the last result to `.devdoctor/last-scan.json`. Use `explain` and `fix` on issue IDs from that scan.

## Install

**Try without installing**

```bash
npx @bishalsingh/devdoctor scan
```

**Install globally from npm** (for repeated use)

```bash
npm install -g @bishalsingh/devdoctor
devdoctor scan
```

### Permission errors on Linux/macOS

If `npm install -g @bishalsingh/devdoctor` fails with `EACCES: permission denied`, npm's default global install location isn't writable by your user. Two options:

- Quick fix: run the install with `sudo`:

  ```bash
  sudo npm install -g @bishalsingh/devdoctor
  ```

- Recommended one-time fix: point npm's global installs at a directory your user owns, so this doesn't happen for any future global package:

  ```bash
  mkdir ~/.npm-global
  npm config set prefix '~/.npm-global'
  echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
  source ~/.bashrc
  ```

  (use `~/.zshrc` instead of `~/.bashrc` if you're on zsh)

  Then retry `npm install -g @bishalsingh/devdoctor` without sudo.

**Local development from source** (clone this repo)

```bash
npm install
npm run build
npm install -g .
devdoctor scan
```

That last `npm install -g .` links the built `bin` so the bare `devdoctor` command works locally too.

## Setting up explain and fix (Groq API key)

`scan` needs no API key. `explain` and `fix` call Groq’s API and require `GROQ_API_KEY`.

1. Sign up at [https://console.groq.com](https://console.groq.com) and create an API key from the dashboard (free tier is enough).
2. Set it in your shell:

   ```bash
   export GROQ_API_KEY=your-key-here
   ```

   or put this in a `.env` file in the **project root you are scanning**:

   ```
   GROQ_API_KEY=your-key-here
   ```

This is a Groq account and key, not npm, Anthropic, or OpenAI.

## Usage

Default command (no subcommand) runs `scan`. Examples below use `npx @bishalsingh/devdoctor …`. If you installed globally, drop `npx @bishalsingh/` and run `devdoctor …` the same way.

```bash
npx @bishalsingh/devdoctor
npx @bishalsingh/devdoctor scan
npx @bishalsingh/devdoctor --version
npx @bishalsingh/devdoctor -V
npx @bishalsingh/devdoctor --help
npx @bishalsingh/devdoctor --verbose
npx @bishalsingh/devdoctor scan --verbose
```

Explain an issue from the last scan (needs `GROQ_API_KEY`):

```bash
npx @bishalsingh/devdoctor explain ISSUE_ID
npx @bishalsingh/devdoctor explain --help
```

Fix an issue (needs `GROQ_API_KEY`). `fix` and `fix --interactive` require an **interactive terminal (a real TTY)**. They will not work when piped, run in CI, or run through non-interactive automation, because they prompt for confirmation before writing any files.

```bash
npx @bishalsingh/devdoctor fix ISSUE_ID
npx @bishalsingh/devdoctor fix --interactive
npx @bishalsingh/devdoctor fix -i
npx @bishalsingh/devdoctor fix --help
```

`--verbose` on the root command or on `scan` prints full error details (including per-check failures).

## Config

Optional project-root file: `.devdoctorrc.json` or `.devdoctorrc`.

```json
{
  "disabledChecks": ["consoleLogLeftIn", "outdatedDependencies"]
}
```

Missing config: all checks run. Invalid JSON: a warning is printed to stderr (`Ignoring invalid .devdoctorrc.json: …`) and the scan continues with every check enabled.

## Checks

| Name | Detects |
| --- | --- |
| `noTestScript` | Missing or npm-placeholder `test` script in package.json |
| `unusedDependencies` | Production dependencies listed but not imported |
| `todoComments` | `TODO` comments in source files |
| `missingErrorMiddleware` | Express apps with no `(err, req, res, next)` handler |
| `largeComponents` | Source files over 500 lines |
| `jwtHardcodedFallback` | Hardcoded JWT secret fallback (`JWT_SECRET \|\| '…'`) |
| `envFileCommitted` | `.env` files tracked by git (not `.env.example` / sample / template) |
| `outdatedDependencies` | Packages more than 2 major versions behind npm latest |
| `gitignoreGaps` | Missing `.gitignore`, or missing relevant Node/TS ignore entries |
| `consoleLogLeftIn` | `console.log` in `src/` outside tests and CLI entry files |

## Development

From a clone, run the CLI with `tsx` (no global install):

```bash
npm run dev
npm run dev -- scan
npm run dev -- --version
npm run dev -- --help
npm run dev -- explain ISSUE_ID
npm run dev -- fix ISSUE_ID
npm run dev -- fix --interactive
```

Build a single bundled file at `dist/cli.js`:

```bash
npm run build
node dist/cli.js scan
```
