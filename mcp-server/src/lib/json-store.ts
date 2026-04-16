import * as fs from "node:fs/promises";
import * as path from "node:path";

function getDataDir(): string {
  return process.env.DATA_DIR || "./data";
}

function resolvePath(relativePath: string): string {
  return path.join(getDataDir(), relativePath);
}

export async function readJsonFile<T>(relativePath: string, defaultValue?: T): Promise<T> {
  const filePath = resolvePath(relativePath);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT" &&
      defaultValue !== undefined
    ) {
      return defaultValue;
    }
    throw err;
  }
}

export async function writeJsonFile<T>(relativePath: string, data: T): Promise<void> {
  const filePath = resolvePath(relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function ensureDir(relativePath: string): Promise<void> {
  await fs.mkdir(resolvePath(relativePath), { recursive: true });
}

export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(resolvePath(relativePath));
    return true;
  } catch {
    return false;
  }
}
