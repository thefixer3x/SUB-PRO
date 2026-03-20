import { Platform } from 'react-native';
import type { Subscription } from '@/types/subscription';

// Dynamic import to avoid crash on web where expo-notifications may not work
let Notifications: typeof import('expo-notifications') | null = null;

async function getNotifications() {
  if (Notifications) return Notifications;
  if (Platform.OS === 'web') return null;
  try {
    Notifications = await import('expo-notifications');
    return Notifications;
  } catch {
    console.warn('expo-notifications not available');
    return null;
  }
}

/** Request notification permissions (call once at app start) */
export async function requestNotificationPermissions(): Promise<boolean> {
  const notif = await getNotifications();
  if (!notif) return false;

  const { status: existing } = await notif.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await notif.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Schedule renewal reminder notifications for a list of subscriptions.
 * Cancels existing scheduled notifications first, then reschedules
 * based on the user's preferred timing (days before renewal).
 */
export async function scheduleRenewalReminders(
  subscriptions: Subscription[],
  daysBefore: number = 3,
): Promise<number> {
  const notif = await getNotifications();
  if (!notif) return 0;

  // Cancel all previously scheduled notifications
  await notif.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  let scheduled = 0;

  for (const sub of subscriptions) {
    if (sub.status !== 'Active') continue;

    const renewalDate = new Date(sub.renewalDate);
    const triggerDate = new Date(renewalDate);
    triggerDate.setDate(triggerDate.getDate() - daysBefore);
    triggerDate.setHours(9, 0, 0, 0); // 9 AM

    // Only schedule if the trigger is in the future
    if (triggerDate <= now) continue;

    await notif.scheduleNotificationAsync({
      content: {
        title: `${sub.name} renewing soon`,
        body: `Your ${sub.planName} plan ($${sub.monthlyCost.toFixed(2)}/${sub.billingCycle.toLowerCase()}) renews on ${renewalDate.toLocaleDateString()}.`,
        data: { subscriptionId: sub.id, type: 'renewal_reminder' },
        sound: true,
      },
      trigger: {
        type: notif.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
    scheduled++;
  }

  console.log(`Scheduled ${scheduled} renewal reminder notifications`);
  return scheduled;
}

/** Cancel all scheduled notifications */
export async function cancelAllNotifications(): Promise<void> {
  const notif = await getNotifications();
  if (!notif) return;
  await notif.cancelAllScheduledNotificationsAsync();
}
