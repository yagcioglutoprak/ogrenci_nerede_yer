import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch {
  // Notifications not available in Expo Go simulator
}

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  await supabase.from('push_tokens').upsert({
    user_id: userId,
    expo_push_token: token,
    platform: Platform.OS,
  }, { onConflict: 'user_id,expo_push_token' });

  return token;
}

export async function sendPushNotification(
  targetUserId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', targetUserId);

  if (!tokens?.length) return;

  const messages = tokens.map((t) => ({
    to: t.expo_push_token,
    sound: 'default' as const,
    title,
    body,
    data: data || {},
  }));

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  }).catch(() => {});
}
