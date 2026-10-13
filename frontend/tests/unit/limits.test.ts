import { describe, expect, it } from "vitest";
import { checkFile, checkJobDescription, limits } from "@/lib/limits";

const file = (name: string, size: number) => new File([new Uint8Array(size)], name);

describe("checkFile", () => {
  it("accepts PDF and DOCX within the size limit", () => {
    expect(checkFile(file("cv.pdf", 1000))).toBeNull();
    expect(checkFile(file("CV.DOCX", 1000))).toBeNull();
  });

  it.each([
    ["cv.doc", 10, "unsupportedFileType"],
    ["cv.png", 10, "unsupportedFileType"],
    ["cv.pdf", 0, "emptyFile"],
    ["cv.pdf", limits.maxUploadBytes + 1, "fileTooLarge"],
  ])("rejects %s (%i bytes) as %s", (name, size, code) => {
    expect(checkFile(file(name, size))?.code).toBe(code);
  });
});

describe("checkJobDescription", () => {
  it("requires text and a minimum length", () => {
    expect(checkJobDescription("   ")).toMatch(/Paste/);
    expect(checkJobDescription("short")).toMatch(/at least/);
    expect(checkJobDescription("x".repeat(limits.minJobDescriptionChars))).toBeNull();
  });
});
