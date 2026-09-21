import { hasValidImageSignature, validatePhoto } from "./validation.js";

export class UploadValidationError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "UploadValidationError";
  }
}

export async function readValidatedPhoto(file, options) {
  const validationError = validatePhoto(file, options);
  if (validationError) throw new UploadValidationError(validationError);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasValidImageSignature(buffer, file.type)) {
    throw new UploadValidationError("The photo's contents did not match its file type.");
  }
  return buffer;
}

function isInvalidImageInput(error) {
  if (!(error instanceof Error)) return false;
  // Sharp/libvips input-decoder errors are distinct from storage, database,
  // configuration, and resource failures. Do not classify by a loose substring.
  return /^Input buffer (?:contains unsupported image format|has corrupt header)(?::|$)/.test(error.message)
    || error.message === "Input image exceeds pixel limit"
    || /(?:^|\n)(?:VipsJpeg|jpegload_buffer|pngload_buffer|vipspng|webpload_buffer|webp):[^\n]*(?:corrupt|invalid|truncat|premature|end of (?:input|file|JPEG)|read error|no image|unable to parse|not enough data)/i.test(error.message);
}

export async function processPhotoInput(processImage) {
  try {
    return await processImage();
  } catch (error) {
    if (isInvalidImageInput(error)) {
      throw new UploadValidationError(
        "This photo could not be read. Choose a valid JPG, PNG, or WebP image.",
        { cause: error },
      );
    }
    throw error;
  }
}
