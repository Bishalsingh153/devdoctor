import { describe, expect, it } from "vitest";
import {
  CONSOLE_LOG_ISSUE_TITLE,
  run,
} from "../../../src/scanner/checks/consoleLogLeftIn.js";
import { fixturePath } from "../../helpers.js";

describe("consoleLogLeftIn", () => {
  it("reports console.log calls in src, ignoring console.error and cli.ts", async () => {
    const issues = await run(fixturePath("has-console-logs"));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      title: CONSOLE_LOG_ISSUE_TITLE,
      severity: "warning",
      detail: "2 console.log calls",
    });
  });

  it("returns no issues when src has no console.log calls", async () => {
    const issues = await run(fixturePath("clean-project"));
    expect(issues).toEqual([]);
  });
});
