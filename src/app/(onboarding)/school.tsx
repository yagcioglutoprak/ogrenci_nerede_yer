import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
} from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuthStore } from '../../stores/authStore';
import { haptic } from '../../lib/haptics';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import SCHOOLS from '../../data/schools.json';

interface School {
  name: string;
  type: string;
  location: string;
}

function normalizeTurkish(text: string): string {
  return text
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/Ş/g, 'ş')
    .replace(/Ğ/g, 'ğ')
    .replace(/Ü/g, 'ü')
    .replace(/Ö/g, 'ö')
    .replace(/Ç/g, 'ç')
    .toLowerCase();
}

export default function SchoolPickerScreen() {
  const router = useRouter();
  const colors = useThemeColors();

  const PAGE_SIZE = 20;
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedSchoolName, setSelectedSchoolName] = useState<string | null>(
    null,
  );

  const allFiltered = useMemo(() => {
    if (!searchQuery.trim()) return SCHOOLS as School[];
    const q = normalizeTurkish(searchQuery.trim());
    return (SCHOOLS as School[]).filter((s) =>
      normalizeTurkish(s.name).includes(q),
    );
  }, [searchQuery]);

  const filteredSchools = useMemo(
    () => allFiltered.slice(0, visibleCount),
    [allFiltered, visibleCount],
  );

  const loadMore = useCallback(() => {
    if (visibleCount < allFiltered.length) {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, allFiltered.length));
    }
  }, [visibleCount, allFiltered.length]);

  const handleSelectSchool = useCallback(
    (school: School) => {
      haptic.light();
      setSelectedSchoolName((prev) =>
        prev === school.name ? null : school.name,
      );
    },
    [],
  );

  const handleContinue = useCallback(async () => {
    if (!selectedSchoolName) return;

    await useAuthStore.getState().updateProfile({
      university: selectedSchoolName,
    });
    haptic.success();
    router.replace('/(onboarding)/preferences');
  }, [selectedSchoolName, router]);

  const handleSkip = useCallback(() => {
    haptic.light();
    router.replace('/(onboarding)/preferences');
  }, [router]);

  const renderSchoolRow = useCallback(
    ({ item }: { item: School }) => {
      const isSelected = item.name === selectedSchoolName;
      const iconName = item.type === 'university' ? 'school-outline' : 'book-outline';

      return (
        <TouchableOpacity
          style={[
            styles.row,
            isSelected && {
              backgroundColor: colors.primarySoft,
              borderRadius: BorderRadius.md,
            },
          ]}
          onPress={() => handleSelectSchool(item)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={iconName}
            size={20}
            color={isSelected ? colors.primary : colors.textTertiary}
            style={styles.rowIcon}
          />

          <View style={styles.rowText}>
            <Text
              style={[
                styles.schoolName,
                { color: isSelected ? colors.primary : colors.text },
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text
              style={[styles.districtLabel, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.location}
            </Text>
          </View>

          {isSelected && (
            <Ionicons
              name="checkmark-circle"
              size={22}
              color={colors.primary}
            />
          )}
        </TouchableOpacity>
      );
    },
    [selectedSchoolName, colors, handleSelectSchool],
  );

  const keyExtractor = useCallback((item: School) => item.name, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Okulun Hangisi?
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Sana yakın mekanları bulalım
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Okul ara..."
          value={searchQuery}
          onChangeText={(text) => { setSearchQuery(text); setVisibleCount(PAGE_SIZE); }}
          icon="search-outline"
        />
      </View>

      {/* School list */}
      <View style={styles.listContainer}>
        <FlatList
          data={filteredSchools}
          keyExtractor={keyExtractor}
          renderItem={renderSchoolRow}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
        />
      </View>

      {/* Bottom actions */}
      <View style={styles.bottomContainer}>
        <Button
          title="Devam"
          onPress={handleContinue}
          disabled={!selectedSchoolName}
          variant="primary"
        />
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipButton}
          activeOpacity={0.7}
        >
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>
            Atla
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xxl,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.md,
    marginTop: Spacing.sm,
  },
  searchContainer: {
    paddingHorizontal: Spacing.xxl,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
  },
  rowIcon: {
    marginRight: Spacing.md,
  },
  rowText: {
    flex: 1,
  },
  schoolName: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.md,
  },
  districtLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  bottomContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  skipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.md,
  },
});
