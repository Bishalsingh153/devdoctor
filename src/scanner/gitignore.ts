import fs from "node:fs/promises";
import path from "node:path";

const ENTRY = ".devdoctor/";

export async function ensureGitignore(projectRoot: string): Promise<void> {
  const gitignorePath = path.join(projectRoot, ".gitignore");

  try {
    const current = await fs.readFile(gitignorePath, "utf8");
    const lines = current.split(/\r?\n/).map((line) => line.trim());
    if (lines.includes(ENTRY) || lines.includes(".devdoctor")) {
      return;
    }
    const prefix = current.endsWith("\n") || current.length === 0 ? "" : "\n";
    await fs.appendFile(gitignorePath, `${prefix}${ENTRY}\n`, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
    await fs.writeFile(gitignorePath, `${ENTRY}\n`, "utf8");
  }
}
