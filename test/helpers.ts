import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { simpleGit } from "simple-git";

const testDir = path.dirname(fileURLToPath(import.meta.url));

export function fixturePath(name: string): string {
  return path.join(testDir, "fixtures", name);
}

export async function initGitRepo(
  dir: string,
  filesToAdd?: string[],
): Promise<void> {
  const git = simpleGit(dir);
  await git.init();
  await git.addConfig("user.email", "devdoctor-test@example.com", false, "local");
  await git.addConfig("user.name", "devdoctor-test", false, "local");
  if (filesToAdd && filesToAdd.length > 0) {
    await git.add(filesToAdd);
  }
}

export async function removeGitRepo(dir: string): Promise<void> {
  await fs.rm(path.join(dir, ".git"), { recursive: true, force: true });
}
