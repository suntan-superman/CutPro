import "server-only";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/server";
import { hasValidImageSignature, validatePhoto } from "@/lib/validation";

const extensionForType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export async function uploadLeadPhotos(leadId, files) {
  const client = createServiceClient();
  if (!client) throw new Error("Storage is not configured.");
  const uploaded = [];

  try {
    for (const file of files) {
      const validationError = validatePhoto(file);
      if (validationError) throw new Error(validationError);
      const buffer = Buffer.from(await file.arrayBuffer());
      if (!hasValidImageSignature(buffer, file.type)) {
        throw new Error("A photo's contents did not match its file type.");
      }

      let storedBuffer = buffer;
      let storedType = file.type;
      let extension = extensionForType[file.type];
      if (["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        storedBuffer = await sharp(buffer)
          .rotate()
          .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        storedType = "image/webp";
        extension = "webp";
      }

      const storagePath = `${leadId}/${randomUUID()}.${extension}`;
      const { error } = await client.storage
        .from("lead-photos")
        .upload(storagePath, storedBuffer, { contentType: storedType, upsert: false });
      if (error) throw new Error("A photo could not be stored.");
      uploaded.push({
        path: storagePath,
        originalName: path.basename(file.name).slice(0, 180),
        originalType: file.type,
        originalSize: file.size,
        storedType,
        storedSize: storedBuffer.length,
      });
    }
    return uploaded;
  } catch (error) {
    if (uploaded.length) {
      await client.storage.from("lead-photos").remove(uploaded.map((item) => item.path));
    }
    throw error;
  }
}

export async function uploadGalleryPhoto(file) {
  const client = createServiceClient();
  if (!client) throw new Error("Storage is not configured.");
  const validationError = validatePhoto(file, { gallery: true });
  if (validationError) throw new Error(validationError);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasValidImageSignature(buffer, file.type)) {
    throw new Error("The photo's contents did not match its file type.");
  }

  const storedBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer();
  const storagePath = `${new Date().getUTCFullYear()}/${randomUUID()}.webp`;
  const { error } = await client.storage
    .from("gallery-media")
    .upload(storagePath, storedBuffer, {
      contentType: "image/webp",
      upsert: false,
      cacheControl: "31536000",
    });
  if (error) throw new Error("The photo could not be stored.");
  const { data } = client.storage.from("gallery-media").getPublicUrl(storagePath);
  return { storagePath, publicUrl: data.publicUrl };
}
