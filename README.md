# devdoctor

CLI for scanning, explaining, and fixing developer environment issues.

`devdoctor scan` runs checks (test script, unused deps, TODOs, Express error middleware, large files, hardcoded JWT fallbacks) and writes the last result to `.devdoctor/last-scan.json`.

## Install

```bash
npm install
npm run build
```

Run without installing globally:

```bash
npx devdoctor
```

After publishing (or from this repo with a local install):

```bash
npm install -g .
devdoctor
```

## Usage

Default command (no subcommand) runs `scan`:

```bash
npx devdoctor
npx devdoctor scan
```

Explain an issue:

```bash
npx devdoctor explain ISSUE_ID
```

Fix an issue:

```bash
npx devdoctor fix ISSUE_ID
npx devdoctor fix --interactive
```

## Development

Run the CLI directly with `tsx` (no build step):

```bash
npm run dev
npm run dev -- scan
npm run dev -- explain ISSUE_ID
npm run dev -- fix ISSUE_ID
npm run dev -- fix --interactive
```

Build a single bundled file at `dist/cli.js`:

```bash
npm run build
node dist/cli.js scan
```
