import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scan } from "../../src/scanner/index.js";
import { TODO_ISSUE_TITLE } from "../../src/scanner/todoPattern.js";
import { CONSOLE_LOG_ISSUE_TITLE } from "../../src/scanner/checks/consoleLogLeftIn.js";
import { fixturePath } from "../helpers.js";

describe("scan()", () => {
  it("returns a clean aggregate result for a healthy project", async () => {
    const result = await scan(fixturePath("clean-project"));

    expect(result.critical).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.healthyCount).toBe(10);
    expect(result.note).toBeUndefined();
  });

  it("aggregates multiple issues and assigns sequential ids", async () => {
    const result = await scan(fixturePath("messy-project"));

    expect(result.critical).toHaveLength(1);
    expect(result.critical[0]?.title).toBe("No test script defined");
    expect(result.critical[0]?.severity).toBe("critical");

    const warningTitles = result.warnings.map((issue) => issue.title);
    expect(warningTitles).toContain(TODO_ISSUE_TITLE);
    expect(warningTitles).toContain(CONSOLE_LOG_ISSUE_TITLE);

    const ids = [...result.critical, ...result.warnings].map((issue) => issue.id);
    expect(ids).toEqual([1, 2, 3]);
    expect(result.healthyCount).toBe(7);
  });

  it("skips checks listed in .devdoctorrc.json", async () => {
    const dir = fixturePath("messy-project");
    const rc = path.join(dir, ".devdoctorrc.json");
    await fs.writeFile(
      rc,
      JSON.stringify({ disabledChecks: ["consoleLogLeftIn", "todoComments"] }),
      "utf8",
    );
    try {
      const result = await scan(dir);
      const warningTitles = result.warnings.map((issue) => issue.title);
      expect(warningTitles).not.toContain(TODO_ISSUE_TITLE);
      expect(warningTitles).not.toContain(CONSOLE_LOG_ISSUE_TITLE);
      expect(result.critical).toHaveLength(1);
      expect(result.healthyCount).toBe(7);
    } finally {
      await fs.rm(rc, { force: true });
    }
  });
});
