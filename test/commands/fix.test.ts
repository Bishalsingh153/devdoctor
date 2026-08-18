import { afterEach, describe, expect, it, vi } from "vitest";
import { runFix } from "../../src/commands/fix.js";

describe("runFix TTY guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits without calling Groq when stdin is not a TTY", async () => {
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: false,
    });
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runFix({ issueId: "1" })).rejects.toThrow("exit:1");
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.join(" ")).toMatch(/interactive terminal/i);
  });
});
