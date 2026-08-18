import { describe, expect, it } from "vitest";
import { run } from "../../../src/scanner/checks/noTestScript.js";
import { fixturePath } from "../../helpers.js";

describe("noTestScript", () => {
  it("reports a critical issue when package.json has no test script", async () => {
    const issues = await run(fixturePath("no-test-script"));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      title: "No test script defined",
      severity: "critical",
    });
  });

  it("reports a critical issue for the npm placeholder test script", async () => {
    const issues = await run(fixturePath("messy-project"));
    expect(issues[0]?.title).toBe("No test script defined");
  });

  it("returns no issues when a real test script exists", async () => {
    const issues = await run(fixturePath("clean-project"));
    expect(issues).toEqual([]);
  });
});
