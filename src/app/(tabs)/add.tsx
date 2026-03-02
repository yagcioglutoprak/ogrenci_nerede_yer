import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, MapPressEvent } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVenueStore } from '../../stores/venueStore';
import { useFeedStore } from '../../stores/feedStore';
import { useAuthStore } from '../../stores/authStore';
import { Colors, DEFAULT_REGION, PriceRanges } from '../../lib/constants';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const VENUE_TAGS = [
  'wifi', 'vejetaryen', 'kahvalti', 'cay', 'ogrenci-indirim',
  'sessiz', 'acik-hava', 'ev-yemegi', 'fast-food', 'tatli',
  'kahve', 'calisma-alani', 'gece-acik', 'ekonomik',
];

type TabMode = 'venue' | 'post';

export default function AddScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { addVenue, venues } = useVenueStore();
  const { createPost } = useFeedStore();

  const [activeTab, setActiveTab] = useState<TabMode>('venue');
  const [submitting, setSubmitting] = useState(false);

  // ---- Venue form state ----
  const [venueName, setVenueName] = useState('');
  const [venueDescription, setVenueDescription] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venuePriceRange, setVenuePriceRange] = useState<1 | 2 | 3 | 4>(1);
  const [venueLocation, setVenueLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [venueTags, setVenueTags] = useState<string[]>([]);
  const [venueImages, setVenueImages] = useState<string[]>([]);

  // ---- Post form state ----
  const [postCaption, setPostCaption] = useState('');
  const [postImages, setPostImages] = useState<string[]>([]);
  const [postVenueId, setPostVenueId] = useState<string | null>(null);
  const [venueSearchQuery, setVenueSearchQuery] = useState('');

  const mapRef = useRef<MapView>(null);

  // Auth guard
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.authGuard}>
          <Ionicons name="lock-closed-outline" size={56} color={Colors.textLight} />
          <Text style={styles.authGuardTitle}>Giris Yap</Text>
          <Text style={styles.authGuardSubtitle}>
            Mekan eklemek veya gonderi paylasmak icin{'\n'}hesabiniza giris yapin.
          </Text>
          <Button
            title="Giris Yap"
            onPress={() => router.push('/auth/login')}
            icon="log-in-outline"
          />
        </View>
      </SafeAreaView>
    );
  }

  const handleMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setVenueLocation({ latitude, longitude });
  };

  const pickImages = async (forVenue: boolean) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Gerekli', 'Fotograf secmek icin galeri erisimi gereklidir.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: !forVenue,
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      if (forVenue) {
        setVenueImages((prev) => [...prev, ...uris].slice(0, 5));
      } else {
        setPostImages((prev) => [...prev, ...uris].slice(0, 10));
      }
    }
  };

  const removeImage = (uri: string, forVenue: boolean) => {
    if (forVenue) {
      setVenueImages((prev) => prev.filter((u) => u !== uri));
    } else {
      setPostImages((prev) => prev.filter((u) => u !== uri));
    }
  };

  const toggleTag = (tag: string) => {
    setVenueTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSubmitVenue = async () => {
    if (!venueName.trim()) {
      Alert.alert('Hata', 'Mekan adi gereklidir.');
      return;
    }
    if (!venueAddress.trim()) {
      Alert.alert('Hata', 'Adres gereklidir.');
      return;
    }
    if (!venueLocation) {
      Alert.alert('Hata', 'Lutfen haritadan konum secin.');
      return;
    }

    setSubmitting(true);
    const { error } = await addVenue({
      name: venueName.trim(),
      description: venueDescription.trim() || null,
      address: venueAddress.trim(),
      latitude: venueLocation.latitude,
      longitude: venueLocation.longitude,
      price_range: venuePriceRange,
      tags: venueTags,
      is_verified: false,
      youtube_video_url: null,
      phone: null,
      cover_image_url: venueImages.length > 0 ? venueImages[0] : null,
      created_by: user.id,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Hata', error);
    } else {
      Alert.alert('Basarili', 'Mekan basariyla eklendi!');
      resetVenueForm();
    }
  };

  const handleSubmitPost = async () => {
    if (!postCaption.trim() && postImages.length === 0) {
      Alert.alert('Hata', 'Bir aciklama yazin veya fotograf ekleyin.');
      return;
    }

    setSubmitting(true);
    const { error } = await createPost({
      user_id: user.id,
      venue_id: postVenueId || undefined,
      caption: postCaption.trim(),
      image_urls: postImages,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Hata', error);
    } else {
      Alert.alert('Basarili', 'Gonderi basariyla paylashildi!');
      resetPostForm();
    }
  };

  const resetVenueForm = () => {
    setVenueName('');
    setVenueDescription('');
    setVenueAddress('');
    setVenuePriceRange(1);
    setVenueLocation(null);
    setVenueTags([]);
    setVenueImages([]);
  };

  const resetPostForm = () => {
    setPostCaption('');
    setPostImages([]);
    setPostVenueId(null);
    setVenueSearchQuery('');
  };

  const filteredVenuesForTag = venues.filter((v) =>
    v.name.toLowerCase().includes(venueSearchQuery.toLowerCase()),
  );

  const selectedVenueForPost = venues.find((v) => v.id === postVenueId);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Yeni Ekle</Text>
        </View>

        {/* Segment Control */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentButton, activeTab === 'venue' && styles.segmentButtonActive]}
            onPress={() => setActiveTab('venue')}
          >
            <Ionicons
              name="restaurant"
              size={18}
              color={activeTab === 'venue' ? '#FFFFFF' : Colors.textSecondary}
            />
            <Text style={[styles.segmentText, activeTab === 'venue' && styles.segmentTextActive]}>
              Mekan Ekle
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, activeTab === 'post' && styles.segmentButtonActive]}
            onPress={() => setActiveTab('post')}
          >
            <Ionicons
              name="camera"
              size={18}
              color={activeTab === 'post' ? '#FFFFFF' : Colors.textSecondary}
            />
            <Text style={[styles.segmentText, activeTab === 'post' && styles.segmentTextActive]}>
              Gonderi Paylas
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'venue' ? (
            /* ======== VENUE FORM ======== */
            <View style={styles.formSection}>
              <Input
                label="Mekan Adi"
                placeholder="Ornek: Ali Usta Doner"
                value={venueName}
                onChangeText={setVenueName}
                icon="restaurant-outline"
              />

              <Input
                label="Aciklama"
                placeholder="Mekan hakkinda kisa bilgi..."
                value={venueDescription}
                onChangeText={setVenueDescription}
                multiline
                icon="document-text-outline"
              />

              <Input
                label="Adres"
                placeholder="Cadde, sokak, numara..."
                value={venueAddress}
                onChangeText={setVenueAddress}
                icon="location-outline"
              />

              {/* Map Picker */}
              <Text style={styles.label}>Konum Sec</Text>
              <Text style={styles.labelHint}>Haritaya dokunarak konum isaretleyin</Text>
              <View style={styles.mapPickerContainer}>
                <MapView
                  ref={mapRef}
                  style={styles.mapPicker}
                  initialRegion={DEFAULT_REGION}
                  onPress={handleMapPress}
                  showsUserLocation
                >
                  {venueLocation && (
                    <Marker coordinate={venueLocation}>
                      <View style={styles.selectedMarker}>
                        <Ionicons name="restaurant" size={16} color="#FFFFFF" />
                      </View>
                    </Marker>
                  )}
                </MapView>
                {venueLocation && (
                  <View style={styles.mapCoords}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                    <Text style={styles.mapCoordsText}>Konum secildi</Text>
                  </View>
                )}
              </View>

              {/* Price Range */}
              <Text style={styles.label}>Fiyat Araligi</Text>
              <View style={styles.priceRow}>
                {PriceRanges.map((price) => {
                  const isActive = venuePriceRange === price.value;
                  return (
                    <TouchableOpacity
                      key={price.value}
                      style={[styles.priceButton, isActive && styles.priceButtonActive]}
                      onPress={() => setVenuePriceRange(price.value as 1 | 2 | 3 | 4)}
                    >
                      <Text style={[styles.priceButtonLabel, isActive && styles.priceButtonLabelActive]}>
                        {price.label}
                      </Text>
                      <Text style={[styles.priceButtonDesc, isActive && styles.priceButtonDescActive]}>
                        {price.description}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Tags */}
              <Text style={styles.label}>Etiketler</Text>
              <View style={styles.tagsGrid}>
                {VENUE_TAGS.map((tag) => {
                  const isActive = venueTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.tagChip, isActive && styles.tagChipActive]}
                      onPress={() => toggleTag(tag)}
                    >
                      {isActive && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      <Text style={[styles.tagChipText, isActive && styles.tagChipTextActive]}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Photo Picker */}
              <Text style={styles.label}>Fotograflar</Text>
              <View style={styles.imageRow}>
                {venueImages.map((uri) => (
                  <View key={uri} style={styles.imageThumb}>
                    <Image source={{ uri }} style={styles.imageThumbImage} />
                    <TouchableOpacity
                      style={styles.imageRemove}
                      onPress={() => removeImage(uri, true)}
                    >
                      <Ionicons name="close-circle" size={22} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
                {venueImages.length < 5 && (
                  <TouchableOpacity
                    style={styles.imageAddButton}
                    onPress={() => pickImages(true)}
                  >
                    <Ionicons name="camera-outline" size={28} color={Colors.textLight} />
                    <Text style={styles.imageAddText}>Ekle</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Submit */}
              <Button
                title={submitting ? 'Ekleniyor...' : 'Mekan Ekle'}
                onPress={handleSubmitVenue}
                loading={submitting}
                disabled={submitting}
                icon="add-circle-outline"
                style={styles.submitButton}
              />
            </View>
          ) : (
            /* ======== POST FORM ======== */
            <View style={styles.formSection}>
              {/* Photo Picker */}
              <Text style={styles.label}>Fotograflar</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.postImagesScroll}
                contentContainerStyle={styles.postImagesScrollContent}
              >
                {postImages.map((uri) => (
                  <View key={uri} style={styles.postImageThumb}>
                    <Image source={{ uri }} style={styles.postImageThumbImage} />
                    <TouchableOpacity
                      style={styles.imageRemove}
                      onPress={() => removeImage(uri, false)}
                    >
                      <Ionicons name="close-circle" size={22} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
                {postImages.length < 10 && (
                  <TouchableOpacity
                    style={styles.postImageAddButton}
                    onPress={() => pickImages(false)}
                  >
                    <Ionicons name="images-outline" size={32} color={Colors.textLight} />
                    <Text style={styles.imageAddText}>Fotograf Sec</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              {/* Caption */}
              <Input
                label="Aciklama"
                placeholder="Deneyimini paylas..."
                value={postCaption}
                onChangeText={setPostCaption}
                multiline
                icon="create-outline"
              />

              {/* Venue Tag Selector */}
              <Text style={styles.label}>Mekan Etiketi (Opsiyonel)</Text>
              {selectedVenueForPost ? (
                <View style={styles.selectedVenueRow}>
                  <Ionicons name="restaurant" size={18} color={Colors.primary} />
                  <Text style={styles.selectedVenueName}>{selectedVenueForPost.name}</Text>
                  <TouchableOpacity onPress={() => setPostVenueId(null)}>
                    <Ionicons name="close-circle" size={20} color={Colors.textLight} />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Input
                    placeholder="Mekan ara..."
                    value={venueSearchQuery}
                    onChangeText={setVenueSearchQuery}
                    icon="search-outline"
                  />
                  {venueSearchQuery.length > 0 && (
                    <View style={styles.venueResults}>
                      {filteredVenuesForTag.slice(0, 5).map((v) => (
                        <TouchableOpacity
                          key={v.id}
                          style={styles.venueResultItem}
                          onPress={() => {
                            setPostVenueId(v.id);
                            setVenueSearchQuery('');
                          }}
                        >
                          <Ionicons name="restaurant-outline" size={16} color={Colors.textSecondary} />
                          <Text style={styles.venueResultName}>{v.name}</Text>
                          <Text style={styles.venueResultAddress} numberOfLines={1}>
                            {v.address}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {filteredVenuesForTag.length === 0 && (
                        <Text style={styles.noVenueResult}>Mekan bulunamadi</Text>
                      )}
                    </View>
                  )}
                </>
              )}

              {/* Submit */}
              <Button
                title={submitting ? 'Paylasiliyor...' : 'Paylas'}
                onPress={handleSubmitPost}
                loading={submitting}
                disabled={submitting}
                icon="paper-plane-outline"
                style={styles.submitButton}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  // Header
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  // Segment Control
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  segmentButtonActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  formSection: {
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
    marginTop: 12,
  },
  labelHint: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 8,
  },
  // Map Picker
  mapPickerContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  mapPicker: {
    width: '100%',
    height: 180,
  },
  selectedMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  mapCoords: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  mapCoordsText: {
    fontSize: 13,
    color: Colors.success,
    fontWeight: '500',
  },
  // Price Range
  priceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  priceButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  priceButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  priceButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  priceButtonLabelActive: {
    color: '#FFFFFF',
  },
  priceButtonDesc: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  priceButtonDescActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  // Tags
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.surface,
  },
  tagChipActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  tagChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tagChipTextActive: {
    color: '#FFFFFF',
  },
  // Images
  imageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  imageThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  imageThumbImage: {
    width: '100%',
    height: '100%',
  },
  imageRemove: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
  },
  imageAddButton: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
  },
  imageAddText: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 2,
  },
  // Post form images
  postImagesScroll: {
    marginBottom: 8,
  },
  postImagesScrollContent: {
    gap: 10,
    paddingRight: 16,
  },
  postImageThumb: {
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  postImageThumbImage: {
    width: '100%',
    height: '100%',
  },
  postImageAddButton: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    gap: 6,
  },
  // Venue search for post
  selectedVenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  selectedVenueName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  venueResults: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: -8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  venueResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  venueResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  venueResultAddress: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  noVenueResult: {
    fontSize: 13,
    color: Colors.textLight,
    textAlign: 'center',
    paddingVertical: 16,
  },
  // Submit
  submitButton: {
    marginTop: 24,
  },
  // Auth guard
  authGuard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  authGuardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
  },
  authGuardSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
});
