import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';

export async function imageToBase64(uri: string): Promise<string> {
  const base64 = await readAsStringAsync(uri, {
    encoding: EncodingType.Base64,
  });
  return base64;
}

export function getMimeTypeFromUri(
  uri: string
): 'image/jpeg' | 'image/png' | 'image/webp' {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg'; // Default to JPEG
}
