import path from "node:path";
import { simpleGit } from "simple-git";

export async function isGitRepo(cwd: string = process.cwd()): Promise<boolean> {
  try {
    const git = simpleGit(cwd);
    if (!(await git.checkIsRepo())) {
      return false;
    }
    const toplevel = (await git.revparse(["--show-toplevel"])).trim();
    return path.resolve(toplevel) === path.resolve(cwd);
  } catch {
    return false;
  }
}

export async function hasUncommittedChanges(
  cwd: string = process.cwd(),
): Promise<boolean> {
  const status = await simpleGit(cwd).status();
  return !status.isClean();
}

export async function currentBranch(
  cwd: string = process.cwd(),
): Promise<string> {
  const status = await simpleGit(cwd).status();
  return status.current ?? "";
}
