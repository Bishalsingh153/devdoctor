import { describe, expect, it } from "vitest";
import { run } from "../../../src/scanner/checks/todoComments.js";
import { TODO_ISSUE_TITLE } from "../../../src/scanner/todoPattern.js";
import { fixturePath } from "../../helpers.js";

describe("todoComments", () => {
  it("reports a warning with the TODO count", async () => {
    const issues = await run(fixturePath("has-todos"));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      title: TODO_ISSUE_TITLE,
      severity: "warning",
      detail: "2 TODO comments",
    });
  });

  it("returns no issues when there are no TODO comments", async () => {
    const issues = await run(fixturePath("clean-project"));
    expect(issues).toEqual([]);
  });
});
