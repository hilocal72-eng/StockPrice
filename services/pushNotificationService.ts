
import { saveSubscription, removeSubscription } from './alertService.ts';

// VAPID Public Key - This must match the one used by your Worker to sign pushes
const VAPID_PUBLIC_KEY = 'BIWQGXCmVRphj00cH4uoTto6aftOEbDiE3Q50aV2kTG22yA98mptczFsY8ztWsa3s0kR9Acx8YjgUpwALTjcLHo';

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
    
    // 1. Get existing subscription
    const existingSubscription = await registration.pushManager.getSubscription();
    
    // 2. FORCE UNSUBSCRIBE to clear out any old VAPID keys/sessions
    if (existingSubscription) {
      await existingSubscription.unsubscribe();
      console.log('Cleared old subscription');
    }

    // 3. NOW create the fresh one with the current VAPID_PUBLIC_KEY
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    console.log('Created fresh subscription:', subscription);
    return await saveSubscription(subscription);
  } catch (error) {
    console.error('Subscription failed:', error);
    return false;
  }
};

export const unsubscribeUser = async (): Promise<boolean> => {
  const subscription = await getPushSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    const success = await subscription.unsubscribe();
    if (success) await removeSubscription(endpoint);
    return success;
  }
  return true;
};
