import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image, Animated,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker } from 'react-native-maps';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../lib/constants';
import { supabase } from '../lib/supabase';
import { useBuddyStore } from '../stores/buddyStore';
import { useAuthStore } from '../stores/authStore';
import { useThemeColors } from '../hooks/useThemeColors';
import * as Location from 'expo-location';
import type { MealBuddy, BuddyMatch } from '../types';

// -- Constants --
const BUDDY_COLOR = '#06B6D4';
const BUDDY_COLOR_DARK = '#0891B2';
const AVAILABILITY_HOURS = 2;

// -- Mock Buddies for offline fallback --
const MOCK_NEARBY_BUDDIES: MealBuddy[] = [
  {
    id: 'mock-b1',
    user_id: 'u-001',
    status: 'available',
    latitude: 41.0095,
    longitude: 28.9550,
    radius_km: 3,
    available_from: new Date().toISOString(),
    available_until: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    note: 'Besiktas civarinda tost yiyelim',
    created_at: new Date().toISOString(),
    user: {
      id: 'u-001',
      email: 'elif@stu.edu.tr',
      username: 'elif_yilmaz',
      full_name: 'Elif Yilmaz',
      avatar_url: 'https://i.pravatar.cc/150?u=elif',
      university: 'Istanbul Universitesi',
      bio: null,
      xp_points: 1250,
      created_at: '2025-09-01T10:00:00Z',
    },
  },
  {
    id: 'mock-b2',
    user_id: 'u-002',
    status: 'available',
    latitude: 41.0120,
    longitude: 28.9800,
    radius_km: 3,
    available_from: new Date().toISOString(),
    available_until: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    note: 'Kadikoy\'de lahmacun',
    created_at: new Date().toISOString(),
    user: {
      id: 'u-002',
      email: 'can@boun.edu.tr',
      username: 'can_demir',
      full_name: 'Can Demir',
      avatar_url: 'https://i.pravatar.cc/150?u=can',
      university: 'Bogazici Universitesi',
      bio: null,
      xp_points: 980,
      created_at: '2025-09-01T10:00:00Z',
    },
  },
  {
    id: 'mock-b3',
    user_id: 'u-003',
    status: 'available',
    latitude: 41.0050,
    longitude: 28.9720,
    radius_km: 3,
    available_from: new Date().toISOString(),
    available_until: new Date(Date.now() + 1.5 * 60 * 60 * 1000).toISOString(),
    note: null,
    created_at: new Date().toISOString(),
    user: {
      id: 'u-003',
      email: 'zeynep@itu.edu.tr',
      username: 'zeynep_k',
      full_name: 'Zeynep Kaya',
      avatar_url: 'https://i.pravatar.cc/150?u=zeynep',
      university: 'ITU',
      bio: null,
      xp_points: 750,
      created_at: '2025-09-01T10:00:00Z',
    },
  },
];

// -- Helper: format remaining time as mm:ss or hh:mm:ss --
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
// Main Screen Component
// =============================================================
export default function BuddyScreen() {
  const router = useRouter();
  const colors = useThemeColors();
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
  const [messageText, setMessageText] = useState('');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedBuddy, setSelectedBuddy] = useState<MealBuddy | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [showRating, setShowRating] = useState(false);
  const [xpAnimVisible, setXpAnimVisible] = useState(false);
  const [useMockBuddies, setUseMockBuddies] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const xpOpacity = useRef(new Animated.Value(0)).current;
  const xpTranslateY = useRef(new Animated.Value(0)).current;

  // -- Derived: effective nearby list (real or mock fallback) --
  const effectiveNearbyBuddies = useMemo(() => {
    if (nearbyBuddies.length > 0) return nearbyBuddies;
    if (useMockBuddies) return MOCK_NEARBY_BUDDIES;
    return [];
  }, [nearbyBuddies, useMockBuddies]);

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
      // If still empty after fetch, enable mock fallback
      const { nearbyBuddies: current } = useBuddyStore.getState();
      if (current.length === 0) {
        setUseMockBuddies(true);
      } else {
        setUseMockBuddies(false);
      }
    };

    doFetch();
    const interval = setInterval(doFetch, 30000);
    return () => clearInterval(interval);
  }, [myBuddy, userLocation]);

  // -- Real-time: subscribe to match updates --
  useEffect(() => {
    if (!user) return;
    const channel = subscribeToMatchUpdates(user.id);
    return () => {
      if (channel) unsubscribeChannel(channel);
    };
  }, [user]);

  // -- Real-time: subscribe to messages when matched --
  useEffect(() => {
    if (!activeMatch) return;
    fetchMessages(activeMatch.id);
    const channel = subscribeToMessages(activeMatch.id);
    return () => {
      if (channel) unsubscribeChannel(channel);
    };
  }, [activeMatch]);

  // -- Auto-scroll messages --
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // -- Countdown timer for availability window --
  useEffect(() => {
    if (!myBuddy) {
      setCountdown(0);
      return;
    }
    const updateCountdown = () => {
      const until = new Date(myBuddy.available_until).getTime();
      const remaining = until - Date.now();
      setCountdown(Math.max(0, remaining));

      // Auto-expire: when time runs out, go unavailable
      if (remaining <= 0) {
        goUnavailable();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [myBuddy]);

  // -- Check if match time expired (for showing rating) --
  useEffect(() => {
    if (!activeMatch) return;
    // Check expiry based on the requester's available_until (the match window)
    const matchBuddy = activeMatch.requester;
    if (!matchBuddy) return;

    const checkExpiry = () => {
      const until = new Date(matchBuddy.available_until).getTime();
      if (Date.now() >= until && !showRating) {
        setShowRating(true);
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 5000);
    return () => clearInterval(interval);
  }, [activeMatch, showRating]);

  // -- Handlers --
  const handleGoAvailable = async () => {
    if (!user || !userLocation) return;
    const now = new Date();
    const until = new Date(now.getTime() + AVAILABILITY_HOURS * 60 * 60 * 1000);
    await goAvailable({
      user_id: user.id,
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      available_from: now.toISOString(),
      available_until: until.toISOString(),
      note: note.trim() || undefined,
    });
    setNote('');
  };

  const handleSendMatch = async (buddy: MealBuddy) => {
    const match = await sendMatchRequest(buddy.id);
    if (match) {
      Alert.alert('Istek Gonderildi', `${buddy.user?.full_name || 'Kullanici'}'a bulusma istegi gonderildi!`);
      setSelectedBuddy(null);
    }
  };

  const handleRespondToMatch = async (matchId: string, accept: boolean) => {
    await respondToMatch(matchId, accept);
    if (accept && user) {
      // Re-fetch active match to enter chat
      await fetchActiveMatch(user.id);
    }
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
    await rateBuddy(activeMatch.id, user.id, thumbsUp);
    setShowRating(false);
    setRatingDone(true);

    // Play XP animation
    setXpAnimVisible(true);
    xpOpacity.setValue(1);
    xpTranslateY.setValue(0);
    Animated.parallel([
      Animated.timing(xpOpacity, {
        toValue: 0,
        duration: 2000,
        useNativeDriver: true,
      }),
      Animated.timing(xpTranslateY, {
        toValue: -60,
        duration: 2000,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setXpAnimVisible(false);
      // Clean up and go back to STATE A
      clearActiveSession();
      if (user) {
        goUnavailable();
      }
    });
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
  // RENDER: STATE D -- Rating (shown as overlay when ratingDone with XP anim)
  // ============================
  if (showRating) {
    const otherBuddy = activeMatch?.requester?.user_id === user.id ? activeMatch?.target : activeMatch?.requester;
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.ratingContainer}>
          <View style={styles.ratingIconWrapper}>
            <Ionicons name="chatbubbles" size={56} color={BUDDY_COLOR} />
          </View>
          <Text style={[styles.ratingTitle, { color: colors.text }]}>Nasil Gecti?</Text>
          <Text style={[styles.ratingSubtitle, { color: colors.textSecondary }]}>
            {otherBuddy?.user?.full_name || 'Buddy'} ile bulusmanizi degerlendir
          </Text>

          <View style={styles.ratingButtons}>
            <TouchableOpacity
              style={[styles.ratingBtn, styles.ratingBtnUp]}
              onPress={() => handleRate(true)}
            >
              <Ionicons name="thumbs-up" size={36} color="#FFF" />
              <Text style={styles.ratingBtnLabel}>Guzeldi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ratingBtn, styles.ratingBtnDown]}
              onPress={() => handleRate(false)}
            >
              <Ionicons name="thumbs-down" size={36} color="#FFF" />
              <Text style={styles.ratingBtnLabel}>Pek degil</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ============================
  // RENDER: XP Animation overlay
  // ============================
  if (xpAnimVisible) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.xpContainer}>
          <Animated.View style={{ opacity: xpOpacity, transform: [{ translateY: xpTranslateY }] }}>
            <Text style={styles.xpText}>+20 XP</Text>
          </Animated.View>
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

    // Calculate chat time remaining (based on the match window)
    const matchBuddy = activeMatch.requester;
    const chatTimeLeft = matchBuddy
      ? Math.max(0, new Date(matchBuddy.available_until).getTime() - Date.now())
      : 0;
    const chatExpired = chatTimeLeft <= 0;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.chatHeader}>
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

        {/* Expired banner */}
        {chatExpired && (
          <TouchableOpacity
            style={styles.expiredBanner}
            onPress={() => setShowRating(true)}
          >
            <Ionicons name="time" size={18} color="#FFF" />
            <Text style={styles.expiredBannerText}>Sure doldu! Bulusmayi degerlendir</Text>
            <Ionicons name="chevron-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        )}

        {/* Messages */}
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
                  { backgroundColor: isMe ? BUDDY_COLOR : colors.backgroundSecondary }]}>
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
              style={[styles.messageInput, { color: colors.text, backgroundColor: colors.backgroundSecondary }]}
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
  // RENDER: STATE B -- Available (Map + Pending Requests)
  // ============================
  if (myBuddy) {
    const isCountdownLow = countdown > 0 && countdown < 15 * 60 * 1000; // less than 15 min

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenterColumn}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Yakinindaki Buddy'ler</Text>
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

        {/* Map */}
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: myBuddy.latitude,
            longitude: myBuddy.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
        >
          <Marker
            coordinate={{ latitude: myBuddy.latitude, longitude: myBuddy.longitude }}
            pinColor={Colors.primary}
            title="Sen"
          />
          {effectiveNearbyBuddies.map((buddy) => (
            <Marker
              key={buddy.id}
              coordinate={{ latitude: buddy.latitude, longitude: buddy.longitude }}
              pinColor={BUDDY_COLOR}
              title={buddy.user?.full_name || 'Buddy'}
              description={buddy.note || undefined}
              onPress={() => setSelectedBuddy(buddy)}
            />
          ))}
        </MapView>

        {/* Loading overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={BUDDY_COLOR} />
            <Text style={{ color: colors.textSecondary, fontSize: FontSize.sm, fontFamily: FontFamily.body }}>
              Buddy araniyor...
            </Text>
          </View>
        )}

        {/* No buddies found */}
        {effectiveNearbyBuddies.length === 0 && !loading && (
          <View style={[styles.noBuddyBanner, { backgroundColor: colors.background }]}>
            <Ionicons name="search-outline" size={24} color={colors.textTertiary} />
            <Text style={{ color: colors.textSecondary, fontFamily: FontFamily.body, textAlign: 'center' }}>
              Henuz yakininda buddy yok. Biraz bekle!
            </Text>
          </View>
        )}

        {/* Mock data indicator */}
        {useMockBuddies && effectiveNearbyBuddies.length > 0 && (
          <View style={styles.mockBadge}>
            <Ionicons name="information-circle" size={14} color={Colors.accent} />
            <Text style={styles.mockBadgeText}>Demo veriler gosteriliyor</Text>
          </View>
        )}

        {/* Pending incoming match requests */}
        {pendingMatches.length > 0 && (
          <View style={[styles.pendingContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.pendingTitle, { color: colors.text }]}>
              Gelen Istekler ({pendingMatches.length})
            </Text>
            <ScrollView horizontal={false} style={{ maxHeight: 200 }}>
              {pendingMatches.map((match) => (
                <PendingMatchCard
                  key={match.id}
                  match={match}
                  userId={user.id}
                  colors={colors}
                  onAccept={() => handleRespondToMatch(match.id, true)}
                  onDecline={() => handleRespondToMatch(match.id, false)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Selected buddy bottom sheet */}
        {selectedBuddy && (
          <View style={[styles.buddySheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.buddySheetRow}>
              {selectedBuddy.user?.avatar_url ? (
                <Image source={{ uri: selectedBuddy.user.avatar_url }} style={styles.buddyAvatar} />
              ) : (
                <View style={[styles.buddyAvatar, styles.buddyAvatarPlaceholder]}>
                  <Ionicons name="person" size={20} color={BUDDY_COLOR} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.buddySheetName, { color: colors.text }]}>
                  {selectedBuddy.user?.full_name || 'Anonim'}
                </Text>
                {selectedBuddy.user?.university && (
                  <Text style={[styles.buddySheetUni, { color: colors.textTertiary }]}>
                    {selectedBuddy.user.university}
                  </Text>
                )}
                {selectedBuddy.note && (
                  <Text style={[styles.buddySheetNote, { color: colors.textSecondary }]}>
                    "{selectedBuddy.note}"
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setSelectedBuddy(null)}>
                <Ionicons name="close-circle" size={24} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.matchRequestBtn} onPress={() => handleSendMatch(selectedBuddy)}>
              <LinearGradient colors={[BUDDY_COLOR, BUDDY_COLOR_DARK]} style={styles.matchRequestBtnGradient}>
                <Ionicons name="hand-right" size={20} color="#FFF" />
                <Text style={styles.matchRequestBtnText}>Bulusma Iste</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // ============================
  // RENDER: STATE A -- Not Available (Form + Incoming Requests)
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

        {/* Pending incoming match requests (visible in STATE A too) */}
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
            style={[styles.formInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            value={note}
            onChangeText={setNote}
            placeholder="ornek: Kadikoy'de tost yiyelim"
            placeholderTextColor={colors.textTertiary}
            maxLength={120}
          />
        </View>

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
// Pending Match Card Component
// =============================================================
interface PendingMatchCardProps {
  match: BuddyMatch;
  userId: string;
  colors: any;
  onAccept: () => void;
  onDecline: () => void;
}

function PendingMatchCard({ match, userId, colors, onAccept, onDecline }: PendingMatchCardProps) {
  // The requester is the person who sent the request (not the current user)
  const requester = match.requester;
  const requesterUser = requester?.user;

  return (
    <View style={[styles.pendingCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
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
  // -- Layout --
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerCenterColumn: { flex: 1, alignItems: 'center' },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.xl, fontFamily: FontFamily.heading },

  // -- Countdown --
  countdownBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: BUDDY_COLOR, paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: BorderRadius.full, marginTop: 2,
  },
  countdownBadgeLow: { backgroundColor: Colors.error },
  countdownText: { color: '#FFF', fontSize: FontSize.xs, fontFamily: FontFamily.bodySemiBold },

  // -- Cancel --
  cancelBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  cancelText: { color: Colors.primary, fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.sm },

  // -- Form (STATE A) --
  formContent: { padding: Spacing.xl, gap: Spacing.xl, paddingBottom: Spacing.xxxl },
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
  durationRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  durationText: { fontSize: FontSize.sm, fontFamily: FontFamily.bodySemiBold },
  locationWarning: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    justifyContent: 'center',
  },
  locationWarningText: { color: Colors.primary, fontFamily: FontFamily.body, fontSize: FontSize.sm },
  goAvailableBtn: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  goAvailableBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.lg,
  },
  goAvailableBtnText: { fontSize: FontSize.lg, fontFamily: FontFamily.headingBold, color: '#FFF' },

  // -- Map (STATE B) --
  map: { flex: 1 },
  loadingOverlay: {
    position: 'absolute', top: 100, alignSelf: 'center',
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  noBuddyBanner: {
    position: 'absolute', bottom: 100, left: Spacing.xl, right: Spacing.xl,
    padding: Spacing.lg, borderRadius: BorderRadius.md, alignItems: 'center', gap: Spacing.sm,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  mockBadge: {
    position: 'absolute', top: 8, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accentSoft, paddingHorizontal: Spacing.md, paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  mockBadgeText: { fontSize: FontSize.xs, fontFamily: FontFamily.body, color: Colors.accent },

  // -- Buddy bottom sheet --
  buddySheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.xl, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1, gap: Spacing.lg,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 8,
  },
  buddySheetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  buddyAvatar: { width: 48, height: 48, borderRadius: 24 },
  buddyAvatarPlaceholder: {
    backgroundColor: '#E0F7FA', justifyContent: 'center', alignItems: 'center',
  },
  buddySheetName: { fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.md },
  buddySheetUni: { fontFamily: FontFamily.body, fontSize: FontSize.xs },
  buddySheetNote: { fontFamily: FontFamily.body, fontSize: FontSize.sm, fontStyle: 'italic', marginTop: 2 },
  matchRequestBtn: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  matchRequestBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md,
  },
  matchRequestBtnText: { fontSize: FontSize.md, fontFamily: FontFamily.headingBold, color: '#FFF' },

  // -- Pending matches --
  pendingContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.lg, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 8,
  },
  pendingTitle: {
    fontSize: FontSize.md, fontFamily: FontFamily.headingBold, marginBottom: Spacing.sm,
  },
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

  // -- Chat (STATE C) --
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F3',
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
  endMeetupText: {
    color: Colors.primary, fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.sm,
  },
  expiredBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, backgroundColor: Colors.accent, paddingVertical: Spacing.sm,
  },
  expiredBannerText: { color: '#FFF', fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.sm },
  messageList: { padding: Spacing.lg, gap: Spacing.sm, flexGrow: 1 },
  emptyChat: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md,
    paddingVertical: 80,
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
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  messageInput: {
    flex: 1, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, fontFamily: FontFamily.body,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: BUDDY_COLOR, justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
  },

  // -- Rating (STATE D) --
  ratingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxxl, gap: Spacing.xl,
  },
  ratingIconWrapper: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#E0F7FA',
    justifyContent: 'center', alignItems: 'center',
  },
  ratingTitle: { fontSize: FontSize.xxl, fontFamily: FontFamily.heading },
  ratingSubtitle: { fontSize: FontSize.md, fontFamily: FontFamily.body, textAlign: 'center' },
  ratingButtons: {
    flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.lg,
  },
  ratingBtn: {
    width: 120, height: 120, borderRadius: 60,
    justifyContent: 'center', alignItems: 'center', gap: Spacing.xs,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6,
  },
  ratingBtnUp: { backgroundColor: Colors.success },
  ratingBtnDown: { backgroundColor: Colors.error },
  ratingBtnLabel: { color: '#FFF', fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.sm },

  // -- XP Animation --
  xpContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md,
  },
  xpText: {
    fontSize: 48, fontFamily: FontFamily.heading, color: Colors.accent,
  },
  xpSubtext: { fontSize: FontSize.lg, fontFamily: FontFamily.body },

  // -- Empty / Login --
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg, padding: Spacing.xxxl },
  emptyTitle: { fontSize: FontSize.xl, fontFamily: FontFamily.heading },
  emptySubtitle: { fontSize: FontSize.md, fontFamily: FontFamily.body, textAlign: 'center' },
  loginBtn: { borderRadius: BorderRadius.md, overflow: 'hidden', width: '100%', maxWidth: 280 },
  loginBtnGradient: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg,
  },
  loginBtnText: { fontSize: FontSize.lg, fontFamily: FontFamily.headingBold, color: '#FFF' },
});
