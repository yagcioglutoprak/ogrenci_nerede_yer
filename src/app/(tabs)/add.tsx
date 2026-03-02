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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, MapPressEvent } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVenueStore } from '../../stores/venueStore';
import { useFeedStore } from '../../stores/feedStore';
import { useAuthStore } from '../../stores/authStore';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  PriceRanges,
  VENUE_TAGS,
  DEFAULT_REGION,
} from '../../lib/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [venueLocation, setVenueLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [venueTags, setVenueTags] = useState<string[]>([]);
  const [venueImages, setVenueImages] = useState<string[]>([]);

  // ---- Post form state ----
  const [postCaption, setPostCaption] = useState('');
  const [postImages, setPostImages] = useState<string[]>([]);
  const [postVenueId, setPostVenueId] = useState<string | null>(null);
  const [venueSearchQuery, setVenueSearchQuery] = useState('');

  const mapRef = useRef<MapView>(null);

  // =============================================
  // AUTH GUARD
  // =============================================
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.authGuard}>
          <View style={styles.authIconCircle}>
            <Ionicons name="restaurant-outline" size={44} color={Colors.primary} />
          </View>
          <Text style={styles.authTitle}>Giris Yap</Text>
          <Text style={styles.authSubtitle}>
            Mekan eklemek veya gonderi paylasmak icin{'\n'}hesabiniza giris yapin.
          </Text>
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
            <Text style={styles.authButtonText}>Giris Yap</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // =============================================
  // HANDLERS
  // =============================================
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
      allowsMultipleSelection: true,
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      if (forVenue) {
        setVenueImages((prev) => [...prev, ...uris].slice(0, 5));
      } else {
        setPostImages((prev) => [...prev, ...uris].slice(0, 5));
      }
    }
  };

  const takePhoto = async (forVenue: boolean) => {
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
      if (forVenue) {
        setVenueImages((prev) => [...prev, uri].slice(0, 5));
      } else {
        setPostImages((prev) => [...prev, uri].slice(0, 5));
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
      Alert.alert('Basarili', 'Gonderi basariyla paylasildi!');
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

  // =============================================
  // RENDER
  // =============================================
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
        <View style={styles.segmentWrapper}>
          <View style={styles.segmentContainer}>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                activeTab === 'venue' && styles.segmentButtonActive,
              ]}
              onPress={() => setActiveTab('venue')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="restaurant"
                size={16}
                color={activeTab === 'venue' ? '#FFFFFF' : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.segmentText,
                  activeTab === 'venue' && styles.segmentTextActive,
                ]}
              >
                Mekan Ekle
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                activeTab === 'post' && styles.segmentButtonActive,
              ]}
              onPress={() => setActiveTab('post')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="camera"
                size={16}
                color={activeTab === 'post' ? '#FFFFFF' : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.segmentText,
                  activeTab === 'post' && styles.segmentTextActive,
                ]}
              >
                Gonderi Paylas
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'venue' ? (
            // ======== VENUE FORM ========
            <View style={styles.formContainer}>
              {/* Mekan Adi */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Temel Bilgiler</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mekan Adi</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="restaurant-outline"
                      size={18}
                      color={Colors.textTertiary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ornek: Ali Usta Doner"
                      placeholderTextColor={Colors.textTertiary}
                      value={venueName}
                      onChangeText={setVenueName}
                      selectionColor={Colors.primary}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Aciklama</Text>
                  <View style={[styles.inputWrapper, styles.inputWrapperMultiline]}>
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color={Colors.textTertiary}
                      style={[styles.inputIcon, { marginTop: 2 }]}
                    />
                    <TextInput
                      style={[styles.textInput, styles.textInputMultiline]}
                      placeholder="Mekan hakkinda kisa bilgi..."
                      placeholderTextColor={Colors.textTertiary}
                      value={venueDescription}
                      onChangeText={setVenueDescription}
                      multiline
                      textAlignVertical="top"
                      selectionColor={Colors.primary}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Adres</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color={Colors.textTertiary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Cadde, sokak, numara..."
                      placeholderTextColor={Colors.textTertiary}
                      value={venueAddress}
                      onChangeText={setVenueAddress}
                      selectionColor={Colors.primary}
                    />
                  </View>
                </View>
              </View>

              {/* Map Picker */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Konum Sec</Text>
                <Text style={styles.sectionHint}>Haritaya dokunarak konum isaretleyin</Text>
                <View style={styles.mapContainer}>
                  <MapView
                    ref={mapRef}
                    style={styles.mapView}
                    initialRegion={DEFAULT_REGION}
                    onPress={handleMapPress}
                    showsUserLocation
                  >
                    {venueLocation && (
                      <Marker coordinate={venueLocation}>
                        <View style={styles.mapMarker}>
                          <Ionicons name="restaurant" size={14} color="#FFFFFF" />
                        </View>
                      </Marker>
                    )}
                  </MapView>
                </View>
                {venueLocation && (
                  <View style={styles.locationConfirm}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.locationConfirmText}>Konum secildi</Text>
                  </View>
                )}
              </View>

              {/* Fiyat Araligi */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Fiyat Araligi</Text>
                <View style={styles.priceRow}>
                  {PriceRanges.map((price) => {
                    const isActive = venuePriceRange === price.value;
                    return (
                      <TouchableOpacity
                        key={price.value}
                        style={[styles.pricePill, isActive && styles.pricePillActive]}
                        onPress={() => setVenuePriceRange(price.value as 1 | 2 | 3 | 4)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.pricePillLabel,
                            isActive && styles.pricePillLabelActive,
                          ]}
                        >
                          {price.label}
                        </Text>
                        <Text
                          style={[
                            styles.pricePillDesc,
                            isActive && styles.pricePillDescActive,
                          ]}
                        >
                          {price.description}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Etiketler */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Etiketler</Text>
                <View style={styles.tagsGrid}>
                  {VENUE_TAGS.map((tag) => {
                    const isActive = venueTags.includes(tag.key);
                    return (
                      <TouchableOpacity
                        key={tag.key}
                        style={[styles.tagChip, isActive && styles.tagChipActive]}
                        onPress={() => toggleTag(tag.key)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={tag.icon as any}
                          size={14}
                          color={isActive ? Colors.accent : Colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.tagChipText,
                            isActive && styles.tagChipTextActive,
                          ]}
                        >
                          {tag.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Fotograflar */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Fotograflar</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.photoScrollContent}
                >
                  {venueImages.map((uri) => (
                    <View key={uri} style={styles.photoThumb}>
                      <Image source={{ uri }} style={styles.photoThumbImage} />
                      <TouchableOpacity
                        style={styles.photoRemoveBtn}
                        onPress={() => removeImage(uri, true)}
                      >
                        <Ionicons name="close" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {venueImages.length < 5 && (
                    <TouchableOpacity
                      style={styles.photoAddBtn}
                      onPress={() => pickImages(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={28} color={Colors.textTertiary} />
                      <Text style={styles.photoAddText}>Ekle</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmitVenue}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Mekani Kaydet</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            // ======== POST FORM ========
            <View style={styles.formContainer}>
              {/* Photo Grid Picker */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Fotograflar</Text>
                <Text style={styles.sectionHint}>En fazla 5 fotograf ekleyebilirsiniz</Text>
                <View style={styles.postPhotoGrid}>
                  {postImages.map((uri) => (
                    <View key={uri} style={styles.postPhotoItem}>
                      <Image source={{ uri }} style={styles.postPhotoImage} />
                      <TouchableOpacity
                        style={styles.photoRemoveBtn}
                        onPress={() => removeImage(uri, false)}
                      >
                        <Ionicons name="close" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {postImages.length < 5 && (
                    <>
                      <TouchableOpacity
                        style={styles.postPhotoAddBtn}
                        onPress={() => pickImages(false)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="images-outline" size={26} color={Colors.textTertiary} />
                        <Text style={styles.postPhotoAddText}>Galeri</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.postPhotoAddBtn}
                        onPress={() => takePhoto(false)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="camera-outline" size={26} color={Colors.textTertiary} />
                        <Text style={styles.postPhotoAddText}>Kamera</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {/* Caption */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Aciklama</Text>
                <View style={[styles.inputWrapper, styles.inputWrapperMultiline]}>
                  <TextInput
                    style={[styles.textInput, styles.textInputMultiline, { paddingLeft: 0 }]}
                    placeholder="Deneyimini paylas..."
                    placeholderTextColor={Colors.textTertiary}
                    value={postCaption}
                    onChangeText={setPostCaption}
                    multiline
                    textAlignVertical="top"
                    selectionColor={Colors.primary}
                  />
                </View>
              </View>

              {/* Venue Tag Selector */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Mekan Etiketi</Text>
                <Text style={styles.sectionHint}>Opsiyonel - gonderinizi bir mekanla iliskilendirin</Text>

                {selectedVenueForPost ? (
                  <View style={styles.selectedVenueCard}>
                    <View style={styles.selectedVenueIcon}>
                      <Ionicons name="restaurant" size={16} color={Colors.primary} />
                    </View>
                    <Text style={styles.selectedVenueName} numberOfLines={1}>
                      {selectedVenueForPost.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setPostVenueId(null)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close-circle" size={22} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="search-outline"
                        size={18}
                        color={Colors.textTertiary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Mekan ara..."
                        placeholderTextColor={Colors.textTertiary}
                        value={venueSearchQuery}
                        onChangeText={setVenueSearchQuery}
                        selectionColor={Colors.primary}
                      />
                    </View>
                    {venueSearchQuery.length > 0 && (
                      <View style={styles.venueSearchResults}>
                        {filteredVenuesForTag.slice(0, 5).map((v) => (
                          <TouchableOpacity
                            key={v.id}
                            style={styles.venueSearchItem}
                            onPress={() => {
                              setPostVenueId(v.id);
                              setVenueSearchQuery('');
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.venueSearchItemIcon}>
                              <Ionicons
                                name="restaurant-outline"
                                size={14}
                                color={Colors.primary}
                              />
                            </View>
                            <View style={styles.venueSearchItemInfo}>
                              <Text style={styles.venueSearchItemName}>{v.name}</Text>
                              <Text style={styles.venueSearchItemAddr} numberOfLines={1}>
                                {v.address}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                        {filteredVenuesForTag.length === 0 && (
                          <View style={styles.venueSearchEmpty}>
                            <Ionicons
                              name="search-outline"
                              size={20}
                              color={Colors.textTertiary}
                            />
                            <Text style={styles.venueSearchEmptyText}>Mekan bulunamadi</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmitPost}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Paylas</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// =============================================
// STYLES
// =============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },

  // Segment Control
  segmentWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs + 2,
  },
  segmentButtonActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  segmentText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },

  // Scroll Content
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 60,
  },
  formContainer: {
    gap: Spacing.lg,
  },

  // Section Cards
  sectionCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  sectionHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },

  // Input styles
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    minHeight: 48,
  },
  inputWrapperMultiline: {
    alignItems: 'flex-start',
    minHeight: 100,
    paddingVertical: Spacing.md,
  },
  inputIcon: {
    marginRight: Spacing.md,
  },
  textInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: 0,
  },
  textInputMultiline: {
    minHeight: 76,
    paddingTop: 2,
    textAlignVertical: 'top',
  },

  // Map
  mapContainer: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mapView: {
    width: '100%',
    height: 150,
  },
  mapMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  locationConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  locationConfirmText: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: '600',
  },

  // Price Range
  priceRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pricePill: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  pricePillActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  pricePillLabel: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  pricePillLabelActive: {
    color: '#FFFFFF',
  },
  pricePillDesc: {
    fontSize: FontSize.xs - 1,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pricePillDescActive: {
    color: 'rgba(255,255,255,0.8)',
  },

  // Tags
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
  },
  tagChipActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accentLight,
  },
  tagChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tagChipTextActive: {
    color: Colors.accentDark,
    fontWeight: '600',
  },

  // Photos
  photoScrollContent: {
    gap: Spacing.md,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  photoRemoveBtn: {
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
  photoAddBtn: {
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
  photoAddText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },

  // Post Photo Grid
  postPhotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  postPhotoItem: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.lg * 2 - Spacing.md * 2) / 3,
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  postPhotoImage: {
    width: '100%',
    height: '100%',
  },
  postPhotoAddBtn: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.lg * 2 - Spacing.md * 2) / 3,
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
  postPhotoAddText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '500',
  },

  // Venue Search
  selectedVenueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '30',
  },
  selectedVenueIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedVenueName: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  venueSearchResults: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  venueSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  venueSearchItemIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueSearchItemInfo: {
    flex: 1,
  },
  venueSearchItemName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  venueSearchItemAddr: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  venueSearchEmpty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  venueSearchEmptyText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },

  // Submit Button
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Auth Guard
  authGuard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl + 8,
  },
  authIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  authTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  authSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    width: '100%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  authButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
