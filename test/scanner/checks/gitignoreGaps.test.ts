import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  GITIGNORE_GAPS_TITLE,
  NO_GITIGNORE_TITLE,
  run,
} from "../../../src/scanner/checks/gitignoreGaps.js";
import { fixturePath, initGitRepo, removeGitRepo } from "../../helpers.js";

describe("gitignoreGaps", () => {
  const gapsDir = fixturePath("gitignore-gaps");
  const cleanDir = fixturePath("clean-project");
  const noIgnoreDir = fixturePath("no-test-script");

  beforeAll(async () => {
    await fs.writeFile(path.join(gapsDir, ".env"), "SECRET=test\n", "utf8");
    await initGitRepo(gapsDir);
    await initGitRepo(cleanDir);
    await initGitRepo(noIgnoreDir);
  });

  afterAll(async () => {
    await removeGitRepo(gapsDir);
    await removeGitRepo(cleanDir);
    await removeGitRepo(noIgnoreDir);
    await fs.rm(path.join(gapsDir, ".env"), { force: true });
  });

  it("warns when a git repo has no .gitignore", async () => {
    const issues = await run(noIgnoreDir);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      title: NO_GITIGNORE_TITLE,
      severity: "warning",
    });
  });

  it("warns for missing relevant entries", async () => {
    const issues = await run(gapsDir);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      title: GITIGNORE_GAPS_TITLE,
      severity: "warning",
    });
    expect(issues[0]?.detail).toContain("dist");
    expect(issues[0]?.detail).toContain(".env");
    expect(issues[0]?.detail).not.toContain("node_modules");
  });

  it("returns no issues when .gitignore covers relevant entries", async () => {
    const issues = await run(cleanDir);
    expect(issues).toEqual([]);
  });
});
