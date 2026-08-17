import { config as loadEnv } from "dotenv";
import { Command } from "commander";
import { runExplain } from "./commands/explain.js";
import { runFix } from "./commands/fix.js";
import { runScan } from "./commands/scan.js";

loadEnv({ quiet: true });

const program = new Command();

program
  .name("devdoctor")
  .description("Scan, explain, and fix developer environment issues")
  .version("0.1.0");

program
  .command("scan", { isDefault: true })
  .description("Scan the current environment for issues")
  .action(async () => {
    await runScan({});
  });

program
  .command("explain")
  .description("Explain a detected issue")
  .argument("<issueId>", "ID of the issue to explain")
  .action(async (issueId: string) => {
    await runExplain({ issueId });
  });

program
  .command("fix")
  .description("Fix a detected issue")
  .argument("[issueId]", "ID of the issue to fix")
  .option("-i, --interactive", "Choose issues interactively")
  .action(async (issueId: string | undefined, options: { interactive?: boolean }) => {
    await runFix({
      issueId,
      interactive: options.interactive,
    });
  });

program.parse();
