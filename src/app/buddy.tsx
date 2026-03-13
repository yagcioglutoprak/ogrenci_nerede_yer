import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
  ScrollView, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../lib/constants';
import { useBuddyStore } from '../stores/buddyStore';
import { useAuthStore } from '../stores/authStore';
import { useThemeColors, useIsDarkMode } from '../hooks/useThemeColors';
import { haptic } from '../lib/haptics';
import SwipeDeck from '../components/buddy/SwipeDeck';
import * as Location from 'expo-location';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import type { MealBuddy, BuddyMatch } from '../types';

// -- Constants --
const BUDDY_COLOR = '#06B6D4';
const BUDDY_COLOR_DARK = '#0891B2';
const AVAILABILITY_HOURS = 2;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// -- Helper: format remaining time --
function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

// =============================================================
// Proximity Slider Component
// =============================================================
function ProximitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const trackWidth = useRef(0);

  const min = 1;
  const max = 10;
  const progress = ((value - min) / (max - min)) * 100;

  const handleTouch = (locationX: number) => {
    if (trackWidth.current <= 0) return;
    const ratio = Math.max(0, Math.min(1, locationX / trackWidth.current));
    const raw = min + ratio * (max - min);
    onChange(Math.max(min, Math.min(max, Math.round(raw))));
    haptic?.light?.();
  };

  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.labelRow}>
        <View style={sliderStyles.labelLeft}>
          <Ionicons name="navigate-outline" size={16} color={BUDDY_COLOR} />
          <Text style={[sliderStyles.label, { color: colors.textSecondary }]}>Mesafe</Text>
        </View>
        <View style={[sliderStyles.valueBadge, {
          backgroundColor: isDark ? 'rgba(6,182,212,0.15)' : 'rgba(6,182,212,0.1)',
        }]}>
          <Text style={sliderStyles.valueText}>{value} km</Text>
        </View>
      </View>

      <View
        onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
        onTouchStart={(e) => handleTouch(e.nativeEvent.locationX)}
        onTouchMove={(e) => handleTouch(e.nativeEvent.locationX)}
        style={[sliderStyles.track, {
          backgroundColor: isDark ? colors.surface : colors.backgroundSecondary,
        }]}
      >
        <LinearGradient
          colors={[BUDDY_COLOR, BUDDY_COLOR_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[sliderStyles.fill, { width: `${progress}%` }]}
        />
        <View style={[sliderStyles.thumb, { left: `${progress}%` }]}>
          <View style={[sliderStyles.thumbOuter, {
            borderColor: isDark ? colors.surface : '#FFF',
          }]}>
            <LinearGradient
              colors={[BUDDY_COLOR, BUDDY_COLOR_DARK]}
              style={sliderStyles.thumbGradient}
            />
          </View>
        </View>
      </View>

      <View style={sliderStyles.tickRow}>
        <Text style={[sliderStyles.tick, { color: colors.textTertiary }]}>{min} km</Text>
        <Text style={[sliderStyles.tick, { color: colors.textTertiary }]}>5 km</Text>
        <Text style={[sliderStyles.tick, { color: colors.textTertiary }]}>{max} km</Text>
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  label: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
  },
  valueBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  valueText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: BUDDY_COLOR,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  thumb: {
    position: 'absolute',
    top: -10,
    marginLeft: -14,
  },
  thumbOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    overflow: 'hidden',
    shadowColor: BUDDY_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  thumbGradient: {
    flex: 1,
  },
  tickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tick: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
});

// =============================================================
// Main Screen Component
// =============================================================
export default function BuddyScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const { user } = useAuthStore();
  const {
    myBuddy, nearbyBuddies, activeMatch, messages, pendingMatches,
    ratingDone, loading,
    fetchMyBuddy, goAvailable, goUnavailable, fetchNearbyBuddies,
    sendMatchRequest, respondToMatch, fetchMessages, sendMessage,
    subscribeToMessages, rateBuddy, fetchActiveMatch, fetchPendingMatches,
    subscribeToMatchUpdates, unsubscribeChannel, setRatingDone,
    clearActiveSession,
  } = useBuddyStore();

  // -- Local state --
  const [note, setNote] = useState('');
  const [radiusKm, setRadiusKm] = useState(3);
  const [messageText, setMessageText] = useState('');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [showRating, setShowRating] = useState(false);
  const [xpAnimVisible, setXpAnimVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const xpOpacity = useSharedValue(0);
  const xpTranslateY = useSharedValue(0);
  const xpAnimStyle = useAnimatedStyle(() => ({
    opacity: xpOpacity.value,
    transform: [{ translateY: xpTranslateY.value }],
  }));

  // -- Derived: effective nearby list --
  const effectiveNearbyBuddies = useMemo(() => {
    return nearbyBuddies;
  }, [nearbyBuddies]);

  // -- Init: fetch user data + location --
  useEffect(() => {
    if (!user) return;
    fetchMyBuddy(user.id);
    fetchActiveMatch(user.id);
    fetchPendingMatches(user.id);

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
  }, [user]);

  // -- Fetch nearby buddies when available --
  useEffect(() => {
    if (!myBuddy || !userLocation) return;

    const doFetch = async () => {
      await fetchNearbyBuddies(userLocation.latitude, userLocation.longitude);
    };

    doFetch();
    const interval = setInterval(doFetch, 30000);
    return () => clearInterval(interval);
  }, [myBuddy, userLocation]);

  // -- Real-time subscriptions --
  useEffect(() => {
    if (!user) return;
    const channel = subscribeToMatchUpdates(user.id);
    return () => { if (channel) unsubscribeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!activeMatch) return;
    fetchMessages(activeMatch.id);
    const channel = subscribeToMessages(activeMatch.id);
    return () => { if (channel) unsubscribeChannel(channel); };
  }, [activeMatch]);

  // -- Auto-scroll messages --
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // -- Countdown timer --
  useEffect(() => {
    if (!myBuddy) { setCountdown(0); return; }
    const updateCountdown = () => {
      const until = new Date(myBuddy.available_until).getTime();
      const remaining = until - Date.now();
      setCountdown(Math.max(0, remaining));
      if (remaining <= 0) goUnavailable();
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [myBuddy]);

  // -- Match expiry check --
  useEffect(() => {
    if (!activeMatch) return;
    const matchBuddy = activeMatch.requester;
    if (!matchBuddy) return;
    const checkExpiry = () => {
      const until = new Date(matchBuddy.available_until).getTime();
      if (Date.now() >= until && !showRating) setShowRating(true);
    };
    checkExpiry();
    const interval = setInterval(checkExpiry, 5000);
    return () => clearInterval(interval);
  }, [activeMatch, showRating]);

  // -- Handlers --
  const handleGoAvailable = async () => {
    if (!user || !userLocation) return;
    haptic?.medium?.();
    const now = new Date();
    const until = new Date(now.getTime() + AVAILABILITY_HOURS * 60 * 60 * 1000);
    await goAvailable({
      user_id: user.id,
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      available_from: now.toISOString(),
      available_until: until.toISOString(),
      note: note.trim() || undefined,
      radius_km: radiusKm,
    });
    setNote('');
  };

  const handleSwipeRight = useCallback(async (buddy: MealBuddy) => {
    haptic?.medium?.();
    const match = await sendMatchRequest(buddy.id);
    if (match) {
      Alert.alert(
        'Istek Gonderildi!',
        `${buddy.user?.full_name || 'Kullanici'}'a bulusma istegi gonderildi! Cevap bekleniyor...`,
      );
    }
  }, []);

  const handleSwipeLeft = useCallback((_buddy: MealBuddy) => {
    haptic?.light?.();
  }, []);

  const handleRespondToMatch = async (matchId: string, accept: boolean) => {
    await respondToMatch(matchId, accept);
    if (accept && user) await fetchActiveMatch(user.id);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeMatch || !user) return;
    await sendMessage(activeMatch.id, user.id, messageText.trim());
    setMessageText('');
  };

  const handleEndMeetup = () => {
    Alert.alert(
      'Bulusmayi Bitir',
      'Bulusmayi bitirmek istediginize emin misiniz?',
      [
        { text: 'Iptal', style: 'cancel' },
        { text: 'Bitir', style: 'destructive', onPress: () => setShowRating(true) },
      ],
    );
  };

  const handleRate = async (thumbsUp: boolean) => {
    if (!activeMatch || !user) return;
    try { await rateBuddy(activeMatch.id, user.id, thumbsUp); } catch {}
    setShowRating(false);
    setRatingDone(true);

    setXpAnimVisible(true);
    xpOpacity.value = 1;
    xpTranslateY.value = 0;
    xpOpacity.value = withTiming(0, { duration: 1200, easing: Easing.out(Easing.cubic) });
    xpTranslateY.value = withTiming(-60, { duration: 1200, easing: Easing.out(Easing.cubic) });
    setTimeout(() => {
      setXpAnimVisible(false);
      clearActiveSession();
      if (user) goUnavailable();
    }, 1300);
  };

  // ============================
  // RENDER: Not logged in
  // ============================
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Ionicons name="people" size={64} color={BUDDY_COLOR} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Giris yapin</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Yemek buddy bulmak icin giris yapmalisiniz
          </Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth/login')}>
            <LinearGradient colors={[BUDDY_COLOR, BUDDY_COLOR_DARK]} style={styles.loginBtnGradient}>
              <Text style={styles.loginBtnText}>Giris Yap</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ============================
  // RENDER: STATE D -- Rating
  // ============================
  if (showRating) {
    const otherBuddy = activeMatch?.requester?.user_id === user.id ? activeMatch?.target : activeMatch?.requester;
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.ratingContainer}>
          <View style={[styles.ratingIconWrapper, { backgroundColor: isDark ? colors.surface : '#E0F7FA' }]}>
            <Ionicons name="chatbubbles" size={56} color={BUDDY_COLOR} />
          </View>
          <Text style={[styles.ratingTitle, { color: colors.text }]}>Nasil Gecti?</Text>
          <Text style={[styles.ratingSubtitle, { color: colors.textSecondary }]}>
            {otherBuddy?.user?.full_name || 'Buddy'} ile bulusmanizi degerlendir
          </Text>
          <View style={styles.ratingButtons}>
            <TouchableOpacity style={[styles.ratingBtn, styles.ratingBtnUp]} onPress={() => handleRate(true)}>
              <Ionicons name="thumbs-up" size={36} color="#FFF" />
              <Text style={styles.ratingBtnLabel}>Guzeldi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ratingBtn, styles.ratingBtnDown]} onPress={() => handleRate(false)}>
              <Ionicons name="thumbs-down" size={36} color="#FFF" />
              <Text style={styles.ratingBtnLabel}>Pek degil</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ============================
  // RENDER: XP Animation
  // ============================
  if (xpAnimVisible) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.xpContainer}>
          <ReAnimated.View style={xpAnimStyle}>
            <Text style={styles.xpText}>+20 XP</Text>
          </ReAnimated.View>
          <Text style={[styles.xpSubtext, { color: colors.textSecondary }]}>Tesekkurler!</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============================
  // RENDER: STATE C -- Matched (Chat)
  // ============================
  if (activeMatch) {
    const otherBuddy = activeMatch.requester?.user_id === user.id ? activeMatch.target : activeMatch.requester;
    const matchBuddy = activeMatch.requester;
    const chatTimeLeft = matchBuddy
      ? Math.max(0, new Date(matchBuddy.available_until).getTime() - Date.now())
      : 0;
    const chatExpired = chatTimeLeft <= 0;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.chatHeader, { borderBottomColor: isDark ? colors.border : '#F0F0F3' }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.chatHeaderCenter}>
            {otherBuddy?.user?.avatar_url ? (
              <Image source={{ uri: otherBuddy.user.avatar_url }} style={styles.chatAvatar} />
            ) : (
              <View style={[styles.chatAvatar, styles.chatAvatarPlaceholder]}>
                <Ionicons name="person" size={16} color={BUDDY_COLOR} />
              </View>
            )}
            <View>
              <Text style={[styles.chatHeaderName, { color: colors.text }]}>
                {otherBuddy?.user?.full_name || 'Yemek Buddy'}
              </Text>
              {!chatExpired && (
                <Text style={[styles.chatHeaderTimer, { color: BUDDY_COLOR }]}>
                  {formatCountdown(chatTimeLeft)} kaldi
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={handleEndMeetup} style={styles.endMeetupBtn}>
            <Text style={styles.endMeetupText}>Bitir</Text>
          </TouchableOpacity>
        </View>

        {chatExpired && (
          <TouchableOpacity style={styles.expiredBanner} onPress={() => setShowRating(true)}>
            <Ionicons name="time" size={18} color="#FFF" />
            <Text style={styles.expiredBannerText}>Sure doldu! Bulusmayi degerlendir</Text>
            <Ionicons name="chevron-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        )}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.textTertiary} />
                <Text style={[styles.emptyChatText, { color: colors.textTertiary }]}>
                  Henuz mesaj yok. Merhaba de!
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMe = item.sender_id === user.id;
              return (
                <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage,
                  { backgroundColor: isMe ? BUDDY_COLOR : isDark ? colors.surface : colors.backgroundSecondary }]}>
                  {!isMe && item.user?.full_name && (
                    <Text style={[styles.messageSender, { color: BUDDY_COLOR }]}>
                      {item.user.full_name}
                    </Text>
                  )}
                  <Text style={[styles.messageText, { color: isMe ? '#FFF' : colors.text }]}>
                    {item.content}
                  </Text>
                  <Text style={[styles.messageTime, { color: isMe ? 'rgba(255,255,255,0.6)' : colors.textTertiary }]}>
                    {new Date(item.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            }}
          />
          <View style={[styles.inputBar, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput
              style={[styles.messageInput, { color: colors.text, backgroundColor: isDark ? colors.surface : colors.backgroundSecondary }]}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Mesaj yaz..."
              placeholderTextColor={colors.textTertiary}
              multiline
            />
            <TouchableOpacity onPress={handleSendMessage} style={styles.sendBtn} disabled={!messageText.trim()}>
              <Ionicons name="send" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ============================
  // RENDER: STATE B -- Available (Swipe Cards)
  // ============================
  if (myBuddy) {
    const isCountdownLow = countdown > 0 && countdown < 15 * 60 * 1000;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenterColumn}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Buddy Bul</Text>
            {countdown > 0 && (
              <View style={[styles.countdownBadge, isCountdownLow && styles.countdownBadgeLow]}>
                <Ionicons name="time-outline" size={12} color="#FFF" />
                <Text style={styles.countdownText}>{formatCountdown(countdown)}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={goUnavailable} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Iptal</Text>
          </TouchableOpacity>
        </View>

        {/* Pending incoming requests notification */}
        {pendingMatches.length > 0 && (
          <TouchableOpacity
            style={styles.pendingNotif}
            onPress={() => {
              // Show first pending match
              const match = pendingMatches[0];
              Alert.alert(
                'Bulusma Istegi',
                `${match.requester?.user?.full_name || 'Birisi'} seninle yemek yemek istiyor!`,
                [
                  { text: 'Reddet', style: 'destructive', onPress: () => handleRespondToMatch(match.id, false) },
                  { text: 'Kabul Et', onPress: () => handleRespondToMatch(match.id, true) },
                ],
              );
            }}
          >
            <LinearGradient
              colors={[BUDDY_COLOR, BUDDY_COLOR_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.pendingNotifGradient}
            >
              <Ionicons name="notifications" size={16} color="#FFF" />
              <Text style={styles.pendingNotifText}>
                {pendingMatches.length} yeni bulusma istegi!
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Loading */}
        {loading && effectiveNearbyBuddies.length === 0 && (
          <View style={styles.loadingCenter}>
            <ActivityIndicator color={BUDDY_COLOR} size="large" />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Yakinindaki buddy'ler araniyor...
            </Text>
          </View>
        )}

        {/* Swipe Deck */}
        {effectiveNearbyBuddies.length > 0 && (
          <SwipeDeck
            buddies={effectiveNearbyBuddies}
            onSwipeRight={handleSwipeRight}
            onSwipeLeft={handleSwipeLeft}
            userLocation={userLocation}
          />
        )}

        {/* No buddies */}
        {effectiveNearbyBuddies.length === 0 && !loading && (
          <View style={styles.noBuddyCenter}>
            <View style={[styles.noBuddyIcon, { backgroundColor: isDark ? colors.surface : 'rgba(6,182,212,0.08)' }]}>
              <Ionicons name="search-outline" size={40} color={BUDDY_COLOR} />
            </View>
            <Text style={[styles.noBuddyTitle, { color: colors.text }]}>
              Henuz buddy yok
            </Text>
            <Text style={[styles.noBuddySubtext, { color: colors.textSecondary }]}>
              Yakininda henuz arayan kimse yok. Biraz bekle!
            </Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // ============================
  // RENDER: STATE A -- Not Available (Form)
  // ============================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Yemek Buddy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formContent}>
        {/* Hero banner */}
        <LinearGradient colors={[BUDDY_COLOR, BUDDY_COLOR_DARK]} style={styles.heroBanner}>
          <Ionicons name="people" size={48} color="#FFF" />
          <Text style={styles.heroBannerTitle}>Yalniz yemek yeme!</Text>
          <Text style={styles.heroBannerSubtitle}>Yakininda yemek arkadasi bul</Text>
        </LinearGradient>

        {/* Pending incoming requests */}
        {pendingMatches.length > 0 && (
          <View style={[styles.pendingSection, { borderColor: colors.border }]}>
            <View style={styles.pendingSectionHeader}>
              <Ionicons name="notifications" size={18} color={Colors.accent} />
              <Text style={[styles.pendingSectionTitle, { color: colors.text }]}>
                Gelen Bulusma Istekleri ({pendingMatches.length})
              </Text>
            </View>
            {pendingMatches.map((match) => (
              <PendingMatchCard
                key={match.id}
                match={match}
                userId={user.id}
                colors={colors}
                isDark={isDark}
                onAccept={() => handleRespondToMatch(match.id, true)}
                onDecline={() => handleRespondToMatch(match.id, false)}
              />
            ))}
          </View>
        )}

        {/* Note input */}
        <View style={styles.formField}>
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Not (istege bagli)</Text>
          <TextInput
            style={[styles.formInput, {
              color: colors.text,
              borderColor: isDark ? colors.border : colors.backgroundSecondary,
              backgroundColor: isDark ? colors.surface : colors.backgroundSecondary,
            }]}
            value={note}
            onChangeText={setNote}
            placeholder="ornek: Kadikoy'de tost yiyelim"
            placeholderTextColor={colors.textTertiary}
            maxLength={120}
          />
        </View>

        {/* Proximity slider */}
        <ProximitySlider value={radiusKm} onChange={setRadiusKm} />

        {/* Duration info */}
        <View style={styles.durationRow}>
          <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.durationText, { color: colors.textSecondary }]}>
            Sure: {AVAILABILITY_HOURS} saat
          </Text>
        </View>

        {/* Location permission */}
        {!userLocation && (
          <View style={styles.locationWarning}>
            <Ionicons name="location-outline" size={18} color={Colors.primary} />
            <Text style={styles.locationWarningText}>Konum izni bekleniyor...</Text>
          </View>
        )}

        {/* Go available button */}
        <TouchableOpacity
          style={[styles.goAvailableBtn, !userLocation && { opacity: 0.5 }]}
          onPress={handleGoAvailable}
          disabled={!userLocation || loading}
        >
          <LinearGradient colors={[BUDDY_COLOR, BUDDY_COLOR_DARK]} style={styles.goAvailableBtnGradient}>
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="search" size={20} color="#FFF" />
                <Text style={styles.goAvailableBtnText}>Buddy Ara!</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// =============================================================
// Pending Match Card
// =============================================================
interface PendingMatchCardProps {
  match: BuddyMatch;
  userId: string;
  colors: any;
  isDark: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

function PendingMatchCard({ match, colors, isDark, onAccept, onDecline }: PendingMatchCardProps) {
  const requester = match.requester;
  const requesterUser = requester?.user;

  return (
    <View style={[styles.pendingCard, {
      backgroundColor: isDark ? colors.surface : colors.backgroundSecondary,
      borderColor: colors.border,
    }]}>
      <View style={styles.pendingCardRow}>
        {requesterUser?.avatar_url ? (
          <Image source={{ uri: requesterUser.avatar_url }} style={styles.pendingAvatar} />
        ) : (
          <View style={[styles.pendingAvatar, styles.pendingAvatarPlaceholder]}>
            <Ionicons name="person" size={18} color={BUDDY_COLOR} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.pendingName, { color: colors.text }]}>
            {requesterUser?.full_name || 'Anonim'}
          </Text>
          {requesterUser?.university && (
            <Text style={[styles.pendingUni, { color: colors.textTertiary }]}>
              {requesterUser.university}
            </Text>
          )}
          {requester?.note && (
            <Text style={[styles.pendingNote, { color: colors.textSecondary }]} numberOfLines={2}>
              "{requester.note}"
            </Text>
          )}
        </View>
      </View>
      <View style={styles.pendingActions}>
        <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
          <Ionicons name="close" size={18} color="#FFF" />
          <Text style={styles.declineBtnText}>Reddet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
          <Ionicons name="checkmark" size={18} color="#FFF" />
          <Text style={styles.acceptBtnText}>Kabul Et</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =============================================================
// Styles
// =============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerCenterColumn: { flex: 1, alignItems: 'center' },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.xl, fontFamily: FontFamily.heading },

  // Countdown
  countdownBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: BUDDY_COLOR, paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: BorderRadius.full, marginTop: 2,
  },
  countdownBadgeLow: { backgroundColor: Colors.error },
  countdownText: { color: '#FFF', fontSize: FontSize.xs, fontFamily: FontFamily.bodySemiBold },

  // Cancel
  cancelBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  cancelText: { color: Colors.primary, fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.sm },

  // Form (STATE A)
  formContent: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: Spacing.xxxl * 2 },
  heroBanner: {
    borderRadius: BorderRadius.lg, padding: Spacing.xxl,
    alignItems: 'center', gap: Spacing.sm,
  },
  heroBannerTitle: { fontSize: FontSize.xxl, fontFamily: FontFamily.heading, color: '#FFF' },
  heroBannerSubtitle: { fontSize: FontSize.md, fontFamily: FontFamily.body, color: 'rgba(255,255,255,0.8)' },
  formField: { gap: Spacing.xs },
  formLabel: { fontSize: FontSize.sm, fontFamily: FontFamily.bodySemiBold },
  formInput: {
    fontSize: FontSize.md, fontFamily: FontFamily.body,
    borderWidth: 1, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  durationText: { fontSize: FontSize.sm, fontFamily: FontFamily.bodySemiBold },
  locationWarning: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'center',
  },
  locationWarningText: { color: Colors.primary, fontFamily: FontFamily.body, fontSize: FontSize.sm },
  goAvailableBtn: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  goAvailableBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.lg,
  },
  goAvailableBtnText: { fontSize: FontSize.lg, fontFamily: FontFamily.headingBold, color: '#FFF' },

  // STATE B - Swipe
  pendingNotif: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: BorderRadius.md, overflow: 'hidden' },
  pendingNotifGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.sm + 2,
  },
  pendingNotifText: { color: '#FFF', fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.sm },
  loadingCenter: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg,
  },
  loadingText: { fontFamily: FontFamily.body, fontSize: FontSize.md },
  noBuddyCenter: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
  },
  noBuddyIcon: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  noBuddyTitle: { fontSize: FontSize.lg, fontFamily: FontFamily.headingBold },
  noBuddySubtext: {
    fontSize: FontSize.sm, fontFamily: FontFamily.body, textAlign: 'center', lineHeight: 20,
  },

  // Pending matches
  pendingSection: {
    borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.lg, gap: Spacing.md,
  },
  pendingSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs,
  },
  pendingSectionTitle: { fontSize: FontSize.md, fontFamily: FontFamily.headingBold },
  pendingCard: {
    borderRadius: BorderRadius.md, padding: Spacing.md, gap: Spacing.md,
    borderWidth: 1, marginBottom: Spacing.sm,
  },
  pendingCardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pendingAvatar: { width: 40, height: 40, borderRadius: 20 },
  pendingAvatarPlaceholder: {
    backgroundColor: '#E0F7FA', justifyContent: 'center', alignItems: 'center',
  },
  pendingName: { fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.md },
  pendingUni: { fontFamily: FontFamily.body, fontSize: FontSize.xs },
  pendingNote: { fontFamily: FontFamily.body, fontSize: FontSize.sm, fontStyle: 'italic', marginTop: 2 },
  pendingActions: { flexDirection: 'row', gap: Spacing.sm },
  declineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, backgroundColor: Colors.error, borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
  },
  declineBtnText: { color: '#FFF', fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.sm },
  acceptBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, backgroundColor: Colors.success, borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
  },
  acceptBtnText: { color: '#FFF', fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.sm },

  // Chat (STATE C)
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  chatHeaderCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  chatAvatar: { width: 36, height: 36, borderRadius: 18 },
  chatAvatarPlaceholder: {
    backgroundColor: '#E0F7FA', justifyContent: 'center', alignItems: 'center',
  },
  chatHeaderName: { fontFamily: FontFamily.headingBold, fontSize: FontSize.md },
  chatHeaderTimer: { fontFamily: FontFamily.body, fontSize: FontSize.xs },
  endMeetupBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    backgroundColor: Colors.primarySoft, borderRadius: BorderRadius.sm,
  },
  endMeetupText: { color: Colors.primary, fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.sm },
  expiredBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, backgroundColor: Colors.accent, paddingVertical: Spacing.sm,
  },
  expiredBannerText: { color: '#FFF', fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.sm },
  messageList: { padding: Spacing.lg, gap: Spacing.sm, flexGrow: 1 },
  emptyChat: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md, paddingVertical: 80,
  },
  emptyChatText: { fontFamily: FontFamily.body, fontSize: FontSize.md },
  messageBubble: {
    maxWidth: '75%', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  myMessage: { alignSelf: 'flex-end' },
  theirMessage: { alignSelf: 'flex-start' },
  messageSender: { fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.xs, marginBottom: 2 },
  messageText: { fontSize: FontSize.md, fontFamily: FontFamily.body },
  messageTime: { fontSize: FontSize.xs, fontFamily: FontFamily.body, marginTop: 2, alignSelf: 'flex-end' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderTopWidth: 1,
  },
  messageInput: {
    flex: 1, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, fontFamily: FontFamily.body, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: BUDDY_COLOR, justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
  },

  // Rating (STATE D)
  ratingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxxl, gap: Spacing.xl,
  },
  ratingIconWrapper: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center',
  },
  ratingTitle: { fontSize: FontSize.xxl, fontFamily: FontFamily.heading },
  ratingSubtitle: { fontSize: FontSize.md, fontFamily: FontFamily.body, textAlign: 'center' },
  ratingButtons: { flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.lg },
  ratingBtn: {
    width: 120, height: 120, borderRadius: 60,
    justifyContent: 'center', alignItems: 'center', gap: Spacing.xs,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6,
  },
  ratingBtnUp: { backgroundColor: Colors.success },
  ratingBtnDown: { backgroundColor: Colors.error },
  ratingBtnLabel: { color: '#FFF', fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.sm },

  // XP Animation
  xpContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  xpText: { fontSize: 48, fontFamily: FontFamily.heading, color: Colors.accent },
  xpSubtext: { fontSize: FontSize.lg, fontFamily: FontFamily.body },

  // Empty / Login
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg, padding: Spacing.xxxl },
  emptyTitle: { fontSize: FontSize.xl, fontFamily: FontFamily.heading },
  emptySubtitle: { fontSize: FontSize.md, fontFamily: FontFamily.body, textAlign: 'center' },
  loginBtn: { borderRadius: BorderRadius.md, overflow: 'hidden', width: '100%', maxWidth: 280 },
  loginBtnGradient: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg },
  loginBtnText: { fontSize: FontSize.lg, fontFamily: FontFamily.headingBold, color: '#FFF' },
});
