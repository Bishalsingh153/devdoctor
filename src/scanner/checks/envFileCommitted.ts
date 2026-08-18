import path from "node:path";
import { simpleGit } from "simple-git";
import { isGitRepo } from "../../lib/git.js";
import type { Issue } from "../types.js";

export const ENV_COMMITTED_TITLE = "Committed .env file may leak secrets";

const ENV_UNTRACK_NOTE =
  "After ignoring, run `git rm --cached <file>` manually — devdoctor will not untrack files.";

export function isTrackedEnvFilename(relativePath: string): boolean {
  const base = path.posix.basename(relativePath.replaceAll("\\", "/"));
  if (base !== ".env" && !base.startsWith(".env.")) {
    return false;
  }
  return !/\.(example|sample|template)$/i.test(base);
}

export async function run(projectRoot: string): Promise<Issue[]> {
  if (!(await isGitRepo(projectRoot))) {
    return [];
  }

  let listed = "";
  try {
    listed = await simpleGit(projectRoot).raw(["ls-files", "-z"]);
  } catch {
    return [];
  }

  const tracked = listed
    .split("\0")
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => file.length > 0 && isTrackedEnvFilename(file));

  if (tracked.length === 0) {
    return [];
  }

  return [
    {
      id: 0,
      title: ENV_COMMITTED_TITLE,
      severity: "critical",
      detail: `${tracked.join(", ")}. ${ENV_UNTRACK_NOTE}`,
    },
  ];
}
