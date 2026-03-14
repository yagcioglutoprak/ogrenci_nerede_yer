import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { registerForPushNotifications } from '../lib/notifications';

export function useNotifications() {
  const router = useRouter();
  const { user } = useAuthStore();
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!user?.id) return;
    let isActive = true;

    const setupNotifications = async () => {
      try {
        await registerForPushNotifications(user.id);

        if (!isActive) return;

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data;
          if (data?.route) {
            routerRef.current.push(data.route as string);
          }
        });
      } catch {
        // Notifications not available in Expo Go simulator
      }
    };

    setupNotifications();

    return () => {
      isActive = false;

      try {
        responseListener.current?.remove();
      } catch {
        // Cleanup failed silently
      }
    };
  }, [user?.id]);
}
