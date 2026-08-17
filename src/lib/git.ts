import { simpleGit } from "simple-git";

export async function isGitRepo(cwd: string = process.cwd()): Promise<boolean> {
  try {
    return await simpleGit(cwd).checkIsRepo();
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
