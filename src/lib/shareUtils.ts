import { RefObject } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

/**
 * Capture a React Native view as an image and open the native share sheet.
 */
export async function captureAndShare(
  viewRef: RefObject<View>,
  options?: { filename?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!viewRef.current) {
      return { success: false, error: 'View reference is not available' };
    }

    // Capture the view as a JPG (smaller file size than PNG)
    const uri = await captureRef(viewRef, {
      format: 'jpg',
      quality: 0.85,
      result: 'tmpfile',
    });

    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return { success: false, error: 'Sharing is not available on this device' };
    }

    // Open native share sheet
    await Sharing.shareAsync(uri, {
      mimeType: 'image/jpeg',
      dialogTitle: 'Ogrenci Nerede Yer?',
      UTI: 'public.jpeg',
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Share failed' };
  }
}
