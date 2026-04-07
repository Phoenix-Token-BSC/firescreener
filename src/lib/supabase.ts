import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Download a file from Supabase Storage
 * @param bucket The storage bucket name
 * @param path The file path within the bucket
 * @returns Buffer containing the file data or null if not found
 */
export async function downloadFile(bucket: string, path: string): Promise<Buffer | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error) {
      console.error('Supabase storage error:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Error downloading file from Supabase:', error);
    return null;
  }
}

/**
 * Get the content type from file extension
 * @param filename The filename or path
 * @returns The MIME type
 */
export function getContentType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Upload a file to Supabase Storage
 * @param bucket The storage bucket name
 * @param path The file path within the bucket
 * @param file The file data (Buffer, Blob, or File)
 * @param contentType The MIME type
 * @returns The URL or error
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer | Blob | File,
  contentType?: string
): Promise<{ publicUrl: string; error: null } | { publicUrl: null; error: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '86400',
        upsert: true,
        contentType: contentType || getContentType(path),
      });

    if (error) {
      console.error(`Supabase upload error (${bucket}/${path}):`, error);
      return { publicUrl: null, error: error.message };
    }

    // Construct the public URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
    return { publicUrl, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error uploading file';
    console.error('Error uploading file to Supabase:', message);
    return { publicUrl: null, error: message };
  }
}

/**
 * Delete a file from Supabase Storage
 * @param bucket The storage bucket name
 * @param path The file path within the bucket
 * @returns Success or error
 */
export async function deleteFile(
  bucket: string,
  path: string
): Promise<{ success: boolean; error: null } | { success: false; error: string }> {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      console.error(`Supabase delete error (${bucket}/${path}):`, error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error deleting file';
    console.error('Error deleting file from Supabase:', message);
    return { success: false, error: message };
  }
}

/**
 * List files in a Supabase Storage bucket (with optional prefix)
 * @param bucket The storage bucket name
 * @param prefix Optional path prefix to filter files
 * @returns Array of file objects or error
 */
export async function listFiles(
  bucket: string,
  prefix?: string
): Promise<{ files: Array<{ name: string; id: string; updated_at: string }> | null; error: null } | { files: null; error: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix || '', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'updated_at', order: 'desc' },
      });

    if (error) {
      console.error(`Supabase list error (${bucket}):`, error);
      return { files: null, error: error.message };
    }

    return { files: data || [], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error listing files';
    console.error('Error listing files from Supabase:', message);
    return { files: null, error: message };
  }
}

/**
 * Get a signed URL for a file in Supabase Storage (for private access)
 * @param bucket The storage bucket name
 * @param path The file path within the bucket
 * @param expiresIn Optional expiration time in seconds (default: 3600)
 * @returns Signed URL or error
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 3600
): Promise<{ signedUrl: string | null; error: null } | { signedUrl: null; error: string }> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error(`Supabase signed URL error (${bucket}/${path}):`, error);
      return { signedUrl: null, error: error.message };
    }

    return { signedUrl: data?.signedUrl || null, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error creating signed URL';
    console.error('Error creating signed URL:', message);
    return { signedUrl: null, error: message };
  }
}