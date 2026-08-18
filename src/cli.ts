import { Command, CommanderError } from "commander";
import { config as loadEnv } from "dotenv";
import { runExplain } from "./commands/explain.js";
import { runFix } from "./commands/fix.js";
import { runScan } from "./commands/scan.js";
import { UserFacingError } from "./lib/errors.js";
import { readPackageVersion } from "./lib/packageVersion.js";

loadEnv({ quiet: true });

const program = new Command();

program
  .name("devdoctor")
  .description("Scan, explain, and fix developer environment issues")
  .version(readPackageVersion(import.meta.url), "-V, --version", "Print the installed version")
  .option("--verbose", "Show full error details")
  .showHelpAfterError()
  .exitOverride();

program
  .command("scan", { isDefault: true })
  .summary("Scan the current project for issues")
  .description(
    "Run all enabled checks in this directory and save results to .devdoctor/last-scan.json",
  )
  .option("--verbose", "Log check failures to stderr")
  .action(async (options: { verbose?: boolean }) => {
    const verbose = Boolean(options.verbose || program.opts().verbose);
    await runScan({ verbose });
  });

program
  .command("explain")
  .summary("Explain why a scan issue matters")
  .description(
    "Explain a detected issue from the last scan (requires GROQ_API_KEY)",
  )
  .argument("<issueId>", "Issue ID from the last scan (e.g. 1)")
  .action(async (issueId: string) => {
    await runExplain({ issueId });
  });

program
  .command("fix")
  .summary("Propose a file-level fix for a scan issue")
  .description(
    "Propose a fix for a scan issue. Files are written only after you confirm. Use --interactive to walk through every issue.",
  )
  .argument(
    "[issueId]",
    "Issue ID from the last scan (omit when using --interactive)",
  )
  .option("-i, --interactive", "Choose and fix issues from the last scan one by one")
  .action(async (issueId: string | undefined, options: { interactive?: boolean }) => {
    await runFix({
      issueId,
      interactive: options.interactive,
    });
  });

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      process.exit(error.exitCode);
    }

    if (error instanceof UserFacingError) {
      console.error(error.message);
      process.exit(error.exitCode);
    }

    const verbose = process.argv.includes("--verbose");
    const message = error instanceof Error ? error.message : String(error);
    if (verbose) {
      console.error(error);
    } else {
      console.error(
        `Something went wrong: ${message}. Run with --verbose for details.`,
      );
    }
    process.exit(1);
  }
}

await main();
