import { describe, it, expect, vi, beforeEach } from "vitest";
import { readJsonFile, writeJsonFile } from "./json-store.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

vi.mock("node:fs/promises");

describe("json-store", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.DATA_DIR = "/test/data";
  });

  describe("readJsonFile", () => {
    it("should read and parse a JSON file", async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{"key":"value"}');
      const result = await readJsonFile<{ key: string }>("test.json");
      expect(result).toEqual({ key: "value" });
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join("/test/data", "test.json"),
        "utf-8",
      );
    });

    it("should return default value when file does not exist", async () => {
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      vi.mocked(fs.readFile).mockRejectedValue(err);
      const result = await readJsonFile("missing.json", { fallback: true });
      expect(result).toEqual({ fallback: true });
    });

    it("should throw on non-ENOENT errors", async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error("permission denied"));
      await expect(readJsonFile("bad.json")).rejects.toThrow("permission denied");
    });
  });

  describe("writeJsonFile", () => {
    it("should write JSON with pretty formatting", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      await writeJsonFile("out.json", { data: 1 });
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join("/test/data", "out.json"),
        JSON.stringify({ data: 1 }, null, 2) + "\n",
        "utf-8",
      );
    });

    it("should create parent directories", async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();
      await writeJsonFile("sub/dir/file.json", {});
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.dirname(path.join("/test/data", "sub/dir/file.json")),
        { recursive: true },
      );
    });
  });
});
