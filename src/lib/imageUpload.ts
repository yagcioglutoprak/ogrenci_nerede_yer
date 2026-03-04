import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

const BUCKET_NAME = 'images';

/**
 * Detect MIME type from URI, handling ph:// and file:// URIs safely.
 */
function detectMimeType(uri: string): { ext: string; mimeType: string } {
  // Extract the path component (strip query params and fragments)
  const path = uri.split('?')[0].split('#')[0];

  // Try to extract extension from the path
  const lastDot = path.lastIndexOf('.');
  const lastSlash = path.lastIndexOf('/');

  // Only use extension if it comes after the last slash (avoids false matches)
  if (lastDot > lastSlash && lastDot < path.length - 1) {
    const ext = path.substring(lastDot + 1).toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      heic: 'image/jpeg', // Convert HEIC → JPEG for broader compatibility
      heif: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    if (mimeMap[ext]) {
      // For HEIC/HEIF, use .jpg extension since we treat them as JPEG
      const finalExt = (ext === 'heic' || ext === 'heif') ? 'jpg' : ext;
      return { ext: finalExt, mimeType: mimeMap[ext] };
    }
  }

  // Default to JPEG for ph:// URIs or unknown extensions
  return { ext: 'jpg', mimeType: 'image/jpeg' };
}

/**
 * Upload a local image URI to Supabase Storage.
 * Returns the public URL of the uploaded image.
 */
export async function uploadImage(
  localUri: string,
  folder: 'posts' | 'venues' | 'avatars' = 'posts',
): Promise<{ url: string | null; error: string | null }> {
  try {
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Determine file extension and MIME type
    const { ext, mimeType } = detectMimeType(localUri);

    // Generate unique filename
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, decode(base64), {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.warn('Supabase upload error:', uploadError.message);
      return { url: null, error: uploadError.message };
    }

    // Get public URL
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    return { url: data.publicUrl, error: null };
  } catch (err: any) {
    console.warn('Image upload failed:', err?.message);
    return { url: null, error: err?.message || 'Fotograf yuklenemedi' };
  }
}

/**
 * Upload multiple local images to Supabase Storage.
 * Returns array of public URLs (skips failed uploads).
 * If all uploads fail, returns the original local URIs as fallback.
 */
export async function uploadImages(
  localUris: string[],
  folder: 'posts' | 'venues' | 'avatars' = 'posts',
): Promise<string[]> {
  if (localUris.length === 0) return [];

  const results = await Promise.all(
    localUris.map((uri) => uploadImage(uri, folder)),
  );

  const uploadedUrls = results
    .filter((r) => r.url !== null)
    .map((r) => r.url as string);

  // If at least one upload succeeded, return uploaded URLs
  // If all failed, return original URIs (they still display locally)
  if (uploadedUrls.length > 0) {
    return uploadedUrls;
  }

  // Fallback: return original local URIs so the app still works
  return localUris;
}
