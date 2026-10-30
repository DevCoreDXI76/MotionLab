import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadAllSecretValues, maskSecrets, readSecret, readSecretFile } from "./secrets";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "secrets-test-"));
  fs.writeFileSync(path.join(dir, "a.txt"), String.fromCharCode(0xfeff) + "# comment\r\nACCOUNT_ID=abcdef123456\r\nAPI_TOKEN=tok_9876543210\r\nSHORT=eu\r\n");
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("secrets", () => {
  it("parses KEY=VALUE files with BOM, comments and CRLF", () => {
    expect(readSecretFile("a.txt", dir)).toEqual({ ACCOUNT_ID: "abcdef123456", API_TOKEN: "tok_9876543210", SHORT: "eu" });
  });

  it("throws without echoing values when a key or file is missing", () => {
    expect(() => readSecret("a.txt", "NOPE", dir)).toThrow("NOPE not set in secrets/a.txt.");
    expect(() => readSecret("missing.txt", "X", dir)).toThrow("secrets/missing.txt not found.");
  });

  it("masks every long secret value in a message", () => {
    const values = loadAllSecretValues(dir);
    expect(values).not.toContain("eu");
    expect(maskSecrets("HTTP 401 for tok_9876543210 on account abcdef123456 in eu", values)).toBe(
      "HTTP 401 for *** on account *** in eu",
    );
  });
});
