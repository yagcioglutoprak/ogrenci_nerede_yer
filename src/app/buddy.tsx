import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker } from 'react-native-maps';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily, DEFAULT_REGION } from '../lib/constants';
import { useBuddyStore } from '../stores/buddyStore';
import { useAuthStore } from '../stores/authStore';
import { useThemeColors } from '../hooks/useThemeColors';
import * as Location from 'expo-location';
import type { MealBuddy } from '../types';

export default function BuddyScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuthStore();
  const {
    myBuddy, nearbyBuddies, activeMatch, messages, loading,
    fetchMyBuddy, goAvailable, goUnavailable, fetchNearbyBuddies,
    sendMatchRequest, fetchMessages, sendMessage, subscribeToMessages,
    fetchActiveMatch, rateBuddy,
  } = useBuddyStore();

  const [note, setNote] = useState('');
  const [messageText, setMessageText] = useState('');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedBuddy, setSelectedBuddy] = useState<MealBuddy | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user) return;
    fetchMyBuddy(user.id);
    fetchActiveMatch(user.id);
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
  }, [user]);

  useEffect(() => {
    if (myBuddy && userLocation) {
      fetchNearbyBuddies(userLocation.latitude, userLocation.longitude);
      const interval = setInterval(() => {
        fetchNearbyBuddies(userLocation.latitude, userLocation.longitude);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [myBuddy, userLocation]);

  useEffect(() => {
    if (!activeMatch) return;
    fetchMessages(activeMatch.id);
    const channel = subscribeToMessages(activeMatch.id);
    return () => {
      if (channel) {
        const { supabase } = require('../lib/supabase');
        supabase.removeChannel(channel);
      }
    };
  }, [activeMatch]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleGoAvailable = async () => {
    if (!user || !userLocation) return;
    const now = new Date();
    const until = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    await goAvailable({
      user_id: user.id,
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      available_from: now.toISOString(),
      available_until: until.toISOString(),
      note: note.trim() || undefined,
    });
  };

  const handleSendMatch = async (buddy: MealBuddy) => {
    const match = await sendMatchRequest(buddy.id);
    if (match) {
      Alert.alert('Istek Gonderildi', `${buddy.user?.full_name || 'Kullanici'}'a bulusma istegi gonderildi!`);
      setSelectedBuddy(null);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !activeMatch || !user) return;
    await sendMessage(activeMatch.id, user.id, messageText.trim());
    setMessageText('');
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Giris yapin</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/auth/login')}>
            <Text style={styles.primaryBtnText}>Giris Yap</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // STATE C: Matched — Chat
  if (activeMatch) {
    const otherBuddy = activeMatch.requester?.user_id === user.id ? activeMatch.target : activeMatch.requester;
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {otherBuddy?.user?.full_name || 'Yemek Buddy'}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm }}
            renderItem={({ item }) => {
              const isMe = item.sender_id === user.id;
              return (
                <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
                  <Text style={[styles.messageText, { color: isMe ? '#FFF' : colors.text }]}>{item.content}</Text>
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
            />
            <TouchableOpacity onPress={handleSendMessage} style={styles.sendBtn}>
              <Ionicons name="send" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // STATE B: Available — Nearby Map
  if (myBuddy) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Yakinindaki Buddy'ler</Text>
          <TouchableOpacity onPress={goUnavailable}>
            <Text style={{ color: Colors.primary, fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.sm }}>Iptal</Text>
          </TouchableOpacity>
        </View>

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
          {nearbyBuddies.map((buddy) => (
            <Marker
              key={buddy.id}
              coordinate={{ latitude: buddy.latitude, longitude: buddy.longitude }}
              pinColor="#06B6D4"
              title={buddy.user?.full_name || 'Buddy'}
              description={buddy.note || undefined}
              onPress={() => setSelectedBuddy(buddy)}
            />
          ))}
        </MapView>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={{ color: colors.textSecondary, fontSize: FontSize.sm }}>Buddy araniyor...</Text>
          </View>
        )}

        {nearbyBuddies.length === 0 && !loading && (
          <View style={styles.noBuddyBanner}>
            <Text style={{ color: colors.textSecondary, fontFamily: FontFamily.body, textAlign: 'center' }}>
              Henuz yakininda buddy yok. Biraz bekle!
            </Text>
          </View>
        )}

        {selectedBuddy && (
          <View style={[styles.buddySheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              {selectedBuddy.user?.avatar_url ? (
                <Image source={{ uri: selectedBuddy.user.avatar_url }} style={styles.buddyAvatar} />
              ) : (
                <View style={[styles.buddyAvatar, { backgroundColor: Colors.primarySoft, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="person" size={20} color={Colors.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[{ fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.md, color: colors.text }]}>
                  {selectedBuddy.user?.full_name || 'Anonim'}
                </Text>
                {selectedBuddy.note && (
                  <Text style={{ fontFamily: FontFamily.body, fontSize: FontSize.sm, color: colors.textSecondary }}>
                    {selectedBuddy.note}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setSelectedBuddy(null)}>
                <Ionicons name="close" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => handleSendMatch(selectedBuddy)}>
              <Text style={styles.primaryBtnText}>Bulusma Iste</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // STATE A: Not available — Form
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Yemek Buddy</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.formContent}>
        <LinearGradient colors={['#06B6D4', '#0891B2']} style={styles.heroBanner}>
          <Ionicons name="people" size={48} color="#FFF" />
          <Text style={styles.heroBannerTitle}>Yalniz yemek yeme!</Text>
          <Text style={styles.heroBannerSubtitle}>Yakininda yemek arkadasi bul</Text>
        </LinearGradient>

        <View style={styles.formField}>
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Not (istege bagli)</Text>
          <TextInput
            style={[styles.formInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            value={note}
            onChangeText={setNote}
            placeholder="ornek: Kadikoy'de tost yiyelim"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <View style={styles.formField}>
          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Sure: 2 saat</Text>
        </View>

        {!userLocation && (
          <Text style={{ color: Colors.primary, textAlign: 'center', fontFamily: FontFamily.body }}>
            Konum izni bekleniyor...
          </Text>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, !userLocation && { opacity: 0.5 }]}
          onPress={handleGoAvailable}
          disabled={!userLocation}
        >
          <LinearGradient colors={['#06B6D4', '#0891B2']} style={styles.primaryBtnGradient}>
            <Ionicons name="search" size={20} color="#FFF" />
            <Text style={styles.primaryBtnText}>Buddy Ara!</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.xl, fontFamily: FontFamily.heading },
  formContent: { flex: 1, padding: Spacing.xl, gap: Spacing.xl },
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
  primaryBtn: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  primaryBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.lg,
  },
  primaryBtnText: { fontSize: FontSize.lg, fontFamily: FontFamily.headingBold, color: '#FFF' },
  map: { flex: 1 },
  loadingOverlay: {
    position: 'absolute', top: 100, alignSelf: 'center',
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  noBuddyBanner: {
    position: 'absolute', bottom: 100, left: Spacing.xl, right: Spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.9)', padding: Spacing.lg, borderRadius: BorderRadius.md,
  },
  buddySheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.xl, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1, gap: Spacing.lg,
  },
  buddyAvatar: { width: 44, height: 44, borderRadius: 22 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.lg },
  emptyTitle: { fontSize: FontSize.xl, fontFamily: FontFamily.heading },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  messageInput: {
    flex: 1, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    fontSize: FontSize.md, fontFamily: FontFamily.body,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#06B6D4', justifyContent: 'center', alignItems: 'center',
  },
  messageBubble: {
    maxWidth: '75%', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  myMessage: { alignSelf: 'flex-end', backgroundColor: '#06B6D4' },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: '#F0F0F0' },
  messageText: { fontSize: FontSize.md, fontFamily: FontFamily.body },
});
