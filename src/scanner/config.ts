import fs from "node:fs/promises";
import path from "node:path";

export interface DevdoctorConfig {
  disabledChecks: string[];
}

const CONFIG_FILES = [".devdoctorrc.json", ".devdoctorrc"] as const;

function asConfig(value: unknown): DevdoctorConfig | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const disabled = (value as { disabledChecks?: unknown }).disabledChecks;
  if (disabled === undefined) {
    return { disabledChecks: [] };
  }
  if (!Array.isArray(disabled) || disabled.some((name) => typeof name !== "string")) {
    return null;
  }
  return { disabledChecks: disabled };
}

export async function loadDevdoctorConfig(
  projectRoot: string,
): Promise<DevdoctorConfig> {
  for (const name of CONFIG_FILES) {
    const filePath = path.join(projectRoot, name);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Ignoring invalid ${name}: ${message}`);
      return { disabledChecks: [] };
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      const config = asConfig(parsed);
      if (!config) {
        console.error(
          `Ignoring invalid ${name}: expected { "disabledChecks": string[] }`,
        );
        return { disabledChecks: [] };
      }
      return config;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Ignoring invalid ${name}: ${message}`);
      return { disabledChecks: [] };
    }
  }

  return { disabledChecks: [] };
}
