import { supabase } from "../lib/supabase";

const PROFILE_PHOTOS_BUCKET = "profile-photos";

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function getStorageErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("bucket") && (normalized.includes("not found") || normalized.includes("does not exist"))) {
    return "Supabase Storage bucket 'profile-photos' is missing. Create a private bucket named profile-photos in Supabase Storage first.";
  }

  return message;
}

export async function resolveMemberPhotoUrl(photoPath: string | null | undefined) {
  if (!photoPath) return null;
  if (isRemoteUrl(photoPath)) return photoPath;

  const { data, error } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .createSignedUrl(photoPath, 60 * 60);

  if (error) {
    throw new Error(getStorageErrorMessage(error.message));
  }

  return data.signedUrl;
}

export async function uploadMemberPhoto(file: File, memberId: string, existingPath?: string | null) {
  const fileExt = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const safeName = sanitizeFileName(file.name);
  const path = `${memberId}/${crypto.randomUUID()}-${safeName || `photo.${fileExt}`}`;

  const { error } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    });

  if (error) {
    throw new Error(getStorageErrorMessage(error.message));
  }

  if (existingPath && !isRemoteUrl(existingPath)) {
    await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([existingPath]);
  }

  return path;
}
