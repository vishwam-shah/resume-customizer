/**
 * Input limits. They mirror backend settings (GET /api/v1/meta) so validation
 * happens instantly in the browser; the server re-checks everything.
 */
export const limits = {
  minJobDescriptionChars: 200,
  maxJobDescriptionChars: 20_000,
  maxUploadBytes: 5 * 1024 * 1024,
  acceptedExtensions: [".pdf", ".docx"],
  acceptedMimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
} as const;

export type FileProblem = { code: string; message: string; hint: string };

export function checkFile(file: File): FileProblem | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".doc")) {
    return {
      code: "unsupportedFileType",
      message: "Old Word .doc files aren't supported.",
      hint: "In Word, choose File > Save As > Word Document (.docx), or export as PDF.",
    };
  }
  if (!limits.acceptedExtensions.some((ext) => name.endsWith(ext))) {
    return {
      code: "unsupportedFileType",
      message: `"${file.name}" isn't a PDF or Word file.`,
      hint: "Upload your resume as a PDF or a Word (.docx) file.",
    };
  }
  if (file.size === 0) {
    return {
      code: "emptyFile",
      message: "That file is empty.",
      hint: "Choose your resume again.",
    };
  }
  if (file.size > limits.maxUploadBytes) {
    return {
      code: "fileTooLarge",
      message: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 5 MB.`,
      hint: "Resumes are usually under 1 MB. Remove embedded images or re-export the PDF.",
    };
  }
  return null;
}

export function checkJobDescription(text: string): string | null {
  const length = text.trim().length;
  if (length === 0) return "Paste the job description.";
  if (length < limits.minJobDescriptionChars) {
    return `Add more of the posting: ${length} of at least ${limits.minJobDescriptionChars} characters. Include the requirements and responsibilities.`;
  }
  if (length > limits.maxJobDescriptionChars) {
    return `That's ${length.toLocaleString()} characters; the limit is ${limits.maxJobDescriptionChars.toLocaleString()}. Remove company boilerplate.`;
  }
  return null;
}
