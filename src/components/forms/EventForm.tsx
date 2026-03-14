import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import Animated, { Layout } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEventStore } from '../../stores/eventStore';
import { useVenueStore } from '../../stores/venueStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { haptic } from '../../lib/haptics';
import GlassView from '../ui/GlassView';
import Button from '../ui/Button';
import type { User } from '../../types';

interface EventFormProps {
  user: User;
}

export default function EventForm({ user }: EventFormProps) {
  const router = useRouter();
  const colors = useThemeColors();
  const { createEvent } = useEventStore();
  const { venues, searchVenues } = useVenueStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueSearchQuery, setVenueSearchQuery] = useState('');
  const [eventDate, setEventDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [maxAttendees, setMaxAttendees] = useState('10');
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const filteredVenues = useMemo(() => venues.filter((v) =>
    v.name.toLowerCase().includes(venueSearchQuery.toLowerCase()),
  ), [venues, venueSearchQuery]);

  const selectedVenue = useMemo(() => venues.find((v) => v.id === venueId), [venues, venueId]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setVenueId(null);
    setVenueSearchQuery('');
    setEventDate(new Date());
    setShowDatePicker(false);
    setShowTimePicker(false);
    setMaxAttendees('10');
    setIsPublic(true);
  };

  const handleVenueSearch = useCallback((query: string) => {
    setVenueSearchQuery(query);
    if (query.length > 1) {
      searchVenues(query);
    }
  }, [searchVenues]);

  const handleTogglePublic = useCallback((value: boolean) => {
    haptic.light();
    setIsPublic(value);
  }, []);

  const handleDateChange = useCallback((_: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setEventDate(date);
      setShowTimePicker(true);
    }
  }, []);

  const handleTimeChange = useCallback((_: any, date?: Date) => {
    setShowTimePicker(false);
    if (date) setEventDate(date);
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Hata', 'Bulusma basligi zorunludur.');
      return;
    }

    setSubmitting(true);
    const { error } = await createEvent({
      creator_id: user.id,
      venue_id: venueId || undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      location_name: selectedVenue?.name || undefined,
      latitude: selectedVenue?.latitude || undefined,
      longitude: selectedVenue?.longitude || undefined,
      event_date: eventDate.toISOString(),
      max_attendees: parseInt(maxAttendees, 10) || 10,
      is_public: isPublic,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Hata', error);
    } else {
      haptic.success();
      Alert.alert('Basarili', 'Bulusma basariyla olusturuldu!');
      resetForm();
      router.back();
    }
  };

  const renderSectionCard = useCallback((children: React.ReactNode) => {
    if (Platform.OS === 'ios') {
      return (
        <GlassView style={styles.sectionCardGlass}>
          {children}
        </GlassView>
      );
    }
    return (
      <View style={[styles.sectionCard, { backgroundColor: colors.background }]}>
        {children}
      </View>
    );
  }, [colors.background]);

  return (
    <View style={styles.formContainer}>
      {/* Title */}
      {renderSectionCard(
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Baslik</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              placeholder="Bulusma basligi..."
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              selectionColor={colors.primary}
            />
          </View>
        </>
      )}

      {/* Description */}
      {renderSectionCard(
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Aciklama</Text>
          <View style={[styles.inputWrapper, styles.inputWrapperMultiline, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline, { color: colors.text }]}
              placeholder="Bulusma hakkinda bir seyler yaz..."
              placeholderTextColor={colors.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
              selectionColor={colors.primary}
            />
          </View>
        </>
      )}

      {/* Venue Picker */}
      {renderSectionCard(
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Mekan</Text>

          {selectedVenue ? (
            <View style={[styles.selectedVenueCard, { backgroundColor: colors.primarySoft }]}>
              <View style={[styles.selectedVenueIcon, { backgroundColor: colors.background }]}>
                <Ionicons name="restaurant" size={16} color={Colors.primary} />
              </View>
              <Text style={[styles.selectedVenueName, { color: colors.text }]} numberOfLines={1}>
                {selectedVenue.name}
              </Text>
              <TouchableOpacity
                onPress={() => setVenueId(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={22} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={[styles.inputWrapper, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Ionicons name="search-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="Mekan ara..."
                  placeholderTextColor={colors.textTertiary}
                  value={venueSearchQuery}
                  onChangeText={handleVenueSearch}
                  selectionColor={colors.primary}
                />
              </View>
              {venueSearchQuery.length > 0 && (
                <View style={[styles.venueSearchResults, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  {filteredVenues.slice(0, 5).map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.venueSearchItem, { borderBottomColor: colors.borderLight }]}
                      onPress={() => {
                        setVenueId(v.id);
                        setVenueSearchQuery('');
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.venueSearchItemIcon, { backgroundColor: colors.primarySoft }]}>
                        <Ionicons name="restaurant-outline" size={14} color={Colors.primary} />
                      </View>
                      <View style={styles.venueSearchItemInfo}>
                        <Text style={[styles.venueSearchItemName, { color: colors.text }]}>{v.name}</Text>
                        <Text style={[styles.venueSearchItemAddr, { color: colors.textSecondary }]} numberOfLines={1}>{v.address}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {filteredVenues.length === 0 && (
                    <View style={styles.venueSearchEmpty}>
                      <Ionicons name="search-outline" size={20} color={Colors.textTertiary} />
                      <Text style={styles.venueSearchEmptyText}>Mekan bulunamadi</Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </>
      )}

      {/* Date & Time */}
      {renderSectionCard(
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Tarih ve Saat</Text>
          <TouchableOpacity
            style={[styles.inputWrapper, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
            <Text style={[styles.textInput, { color: colors.text }]}>
              {eventDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' '}
              {eventDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={eventDate}
              mode="date"
              minimumDate={new Date()}
              onChange={handleDateChange}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={eventDate}
              mode="time"
              onChange={handleTimeChange}
            />
          )}
        </>
      )}

      {/* Max Attendees */}
      {renderSectionCard(
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Maksimum Katilimci</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Ionicons name="people-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              placeholder="10"
              placeholderTextColor={colors.textTertiary}
              value={maxAttendees}
              onChangeText={setMaxAttendees}
              keyboardType="number-pad"
              selectionColor={colors.primary}
            />
          </View>
        </>
      )}

      {/* Public Toggle */}
      {renderSectionCard(
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Gorunurluk</Text>
          <Animated.View style={styles.toggleRow} layout={Layout.springify()}>
            <Animated.View style={{ flex: 1 }} layout={Layout.springify()}>
              <TouchableOpacity
                style={[
                  styles.toggleOption,
                  isPublic && styles.toggleOptionActive,
                  { borderColor: isPublic ? Colors.primary : colors.border },
                ]}
                onPress={() => handleTogglePublic(true)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="globe-outline"
                  size={18}
                  color={isPublic ? Colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.toggleOptionText,
                    { color: isPublic ? Colors.primary : colors.textSecondary },
                  ]}
                >
                  Herkese Acik
                </Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={{ flex: 1 }} layout={Layout.springify()}>
              <TouchableOpacity
                style={[
                  styles.toggleOption,
                  !isPublic && styles.toggleOptionActive,
                  { borderColor: !isPublic ? Colors.primary : colors.border },
                ]}
                onPress={() => handleTogglePublic(false)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={!isPublic ? Colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.toggleOptionText,
                    { color: !isPublic ? Colors.primary : colors.textSecondary },
                  ]}
                >
                  Sadece Takipciler
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </>
      )}

      {/* Submit */}
      <Button
        title="Bulusma Olustur"
        variant="primary"
        onPress={handleSubmit}
        loading={submitting}
        icon="people"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    gap: Spacing.lg,
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionCardGlass: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: Colors.text,
    marginBottom: Spacing.md,
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
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  toggleOptionActive: {
    backgroundColor: Colors.primarySoft,
  },
  toggleOptionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
