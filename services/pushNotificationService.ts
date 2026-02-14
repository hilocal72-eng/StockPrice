
import { saveSubscription, removeSubscription } from './alertService.ts';

// Replace with your actual VAPID Public Key from your push service provider
const VAPID_PUBLIC_KEY = 'BAoyqSy6cUSv2Z8hwNbiu3g7JkdqF9fvOiZg_hv-5-hfxVjolg1pKSKY-RLuT9uIHNW6CX82hJsuhRRdT27pSr0';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const isPushSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

export const getNotificationPermission = (): NotificationPermission => {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) return 'denied';
  return await Notification.requestPermission();
};

export const getPushSubscription = async (): Promise<PushSubscription | null> => {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return await registration.pushManager.getSubscription();
};

export const subscribeUser = async (): Promise<boolean> => {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    return await saveSubscription(subscription);
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return false;
  }
};

export const unsubscribeUser = async (): Promise<boolean> => {
  if (!isPushSupported()) return false;

  try {
    const subscription = await getPushSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      await removeSubscription(subscription.endpoint);
    }
    return true;
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
    return false;
  }
};
