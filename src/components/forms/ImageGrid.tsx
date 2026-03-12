import React from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Text } from 'react-native';
import { Colors, Spacing, BorderRadius, FontSize } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ImageGridProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  layout?: 'horizontal' | 'grid';
}

export default function ImageGrid({
  images,
  onImagesChange,
  maxImages = 5,
  layout = 'grid',
}: ImageGridProps) {
  const colors = useThemeColors();
  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Gerekli', 'Fotograf secmek icin galeri erisimi gereklidir.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      onImagesChange([...images, ...uris].slice(0, maxImages));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Gerekli', 'Kamera erisimi gereklidir.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      onImagesChange([...images, uri].slice(0, maxImages));
    }
  };

  const removeImage = (uri: string) => {
    onImagesChange(images.filter((u) => u !== uri));
  };

  if (layout === 'horizontal') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScroll}
      >
        {images.map((uri) => (
          <Animated.View
            key={uri}
            style={styles.horizontalThumb}
            entering={FadeIn.springify()}
            layout={Layout.springify()}
          >
            <Image source={{ uri }} style={styles.horizontalImage} />
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => removeImage(uri)}
            >
              <Ionicons name="close" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        ))}
        {images.length < maxImages && (
          <TouchableOpacity
            style={[styles.horizontalAddBtn, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            onPress={pickImages}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={28} color={Colors.textTertiary} />
            <Text style={[styles.addText, { color: colors.textTertiary }]}>Ekle</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  // Grid layout
  const ITEM_SIZE = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.lg * 2 - Spacing.md * 2) / 3;

  return (
    <Animated.View style={styles.grid} layout={Layout.springify()}>
      {images.map((uri) => (
        <Animated.View
          key={uri}
          style={[styles.gridItem, { width: ITEM_SIZE }]}
          entering={FadeIn.springify()}
          layout={Layout.springify()}
        >
          <Image source={{ uri }} style={styles.gridImage} />
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => removeImage(uri)}
          >
            <Ionicons name="close" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>
      ))}
      {images.length < maxImages && (
        <>
          <TouchableOpacity
            style={[styles.gridAddBtn, { width: ITEM_SIZE, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            onPress={pickImages}
            activeOpacity={0.7}
          >
            <Ionicons name="images-outline" size={26} color={Colors.textTertiary} />
            <Text style={[styles.addText, { color: colors.textTertiary }]}>Galeri</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.gridAddBtn, { width: ITEM_SIZE, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            onPress={takePhoto}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={26} color={Colors.textTertiary} />
            <Text style={[styles.addText, { color: colors.textTertiary }]}>Kamera</Text>
          </TouchableOpacity>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Horizontal layout
  horizontalScroll: {
    gap: Spacing.md,
  },
  horizontalThumb: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  horizontalImage: {
    width: '100%',
    height: '100%',
  },
  horizontalAddBtn: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundSecondary,
    gap: Spacing.xs,
  },

  // Grid layout
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  gridItem: {
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridAddBtn: {
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundSecondary,
    gap: Spacing.xs,
  },

  // Shared
  removeBtn: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: BorderRadius.full,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
});
