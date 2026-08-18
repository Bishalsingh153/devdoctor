import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function readPackageVersion(fromUrl: string = import.meta.url): string {
  let dir = path.dirname(fileURLToPath(fromUrl));

  for (let i = 0; i < 8; i += 1) {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(dir, "package.json"), "utf8"),
      ) as { version?: unknown };
      if (typeof pkg.version === "string" && pkg.version.length > 0) {
        return pkg.version;
      }
    } catch {
      // keep walking toward the repo root
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return "0.0.0";
}
