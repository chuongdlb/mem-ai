import { describe, it, expect } from "vitest";
import { generatePat, hashPat } from "./pat.js";

describe("generatePat", () => {
  it("generates a token with memai_ prefix", () => {
    const { token } = generatePat();
    expect(token).toMatch(/^memai_[0-9a-f]{64}$/);
  });

  it("generates a SHA-256 hash", () => {
    const { hash } = generatePat();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hash matches hashPat of the token", () => {
    const { token, hash } = generatePat();
    expect(hashPat(token)).toBe(hash);
  });

  it("generates unique tokens each time", () => {
    const a = generatePat();
    const b = generatePat();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("hashPat", () => {
  it("produces consistent hashes for the same input", () => {
    const token = "memai_test123";
    expect(hashPat(token)).toBe(hashPat(token));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashPat("memai_a")).not.toBe(hashPat("memai_b"));
  });

  it("returns a 64-char hex string", () => {
    const hash = hashPat("anything");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
