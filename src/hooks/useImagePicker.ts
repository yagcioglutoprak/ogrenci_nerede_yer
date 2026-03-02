import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

interface UseImagePickerOptions {
  maxImages?: number;
  quality?: number;
  allowsEditing?: boolean;
}

export function useImagePicker(options: UseImagePickerOptions = {}) {
  const { maxImages = 5, quality = 0.8, allowsEditing = false } = options;
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const pickFromGallery = async () => {
    if (images.length >= maxImages) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    setLoading(true);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing,
      quality,
      allowsMultipleSelection: true,
      selectionLimit: maxImages - images.length,
    });

    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...newUris].slice(0, maxImages));
    }
    setLoading(false);
  };

  const takePhoto = async () => {
    if (images.length >= maxImages) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;

    setLoading(true);
    const result = await ImagePicker.launchCameraAsync({
      quality,
      allowsEditing,
    });

    if (!result.canceled) {
      setImages((prev) => [...prev, result.assets[0].uri].slice(0, maxImages));
    }
    setLoading(false);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const clearImages = () => setImages([]);

  return {
    images,
    loading,
    pickFromGallery,
    takePhoto,
    removeImage,
    clearImages,
    canAddMore: images.length < maxImages,
  };
}
