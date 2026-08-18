import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ENV_COMMITTED_TITLE,
  run,
} from "../../../src/scanner/checks/envFileCommitted.js";
import { fixturePath, initGitRepo, removeGitRepo } from "../../helpers.js";

describe("envFileCommitted", () => {
  const dir = fixturePath("tracked-env");
  const envPath = path.join(dir, ".env");

  beforeAll(async () => {
    await fs.writeFile(envPath, "SECRET=test\n", "utf8");
    await initGitRepo(dir, [".env", ".env.example", "package.json", "src/index.ts"]);
  });

  afterAll(async () => {
    await removeGitRepo(dir);
    await fs.rm(envPath, { force: true });
  });

  it("flags a tracked .env file and skips .env.example", async () => {
    const issues = await run(dir);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      title: ENV_COMMITTED_TITLE,
      severity: "critical",
    });
    expect(issues[0]?.detail).toContain(".env");
    expect(issues[0]?.detail).not.toContain(".env.example");
  });

  it("returns no issues when the project is not a git repo", async () => {
    const issues = await run(fixturePath("has-todos"));
    expect(issues).toEqual([]);
  });
});
