
import { saveSubscription, removeSubscription } from './alertService.ts';

// Replace with your actual VAPID Public Key from your push service provider
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
  try {
    return await Notification.requestPermission();
  } catch (e) {
    // Some older browsers might use callback instead of promise
    return new Promise((resolve) => {
      Notification.requestPermission((result) => resolve(result));
    });
  }
};

export const getPushSubscription = async (): Promise<PushSubscription | null> => {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (e) {
    console.error('Error checking existing push subscription:', e);
    return null;
  }
};

export const subscribeUser = async (): Promise<boolean> => {
  if (!isPushSupported()) {
    console.warn('Push is not supported on this browser/environment.');
    return false;
  }

  try {
    // Ensure we have the service worker ready
    const registration = await navigator.serviceWorker.ready;
    
    // Check if subscription already exists
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('User already has a subscription, syncing with server...');
      return await saveSubscription(subscription);
    }

    // New subscription
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    if (!subscription) {
      console.error('PushManager.subscribe returned null/undefined');
      return false;
    }

    return await saveSubscription(subscription);
  } catch (error: any) {
    console.error('Failed to subscribe to push notifications:', error);
    
    // Check for specific common errors
    if (error.name === 'NotAllowedError') {
      console.warn('Permission denied by user.');
    } else if (error.name === 'AbortError') {
      console.warn('Subscription aborted.');
    } else if (error.name === 'InvalidStateError') {
      console.warn('Service worker not ready or active.');
    }
    
    return false;
  }
};

export const unsubscribeUser = async (): Promise<boolean> => {
  if (!isPushSupported()) return false;

  try {
    const subscription = await getPushSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      const success = await subscription.unsubscribe();
      if (success) {
        await removeSubscription(endpoint);
      }
      return success;
    }
    return true;
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
    return false;
  }
};
