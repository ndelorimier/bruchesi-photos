import { ref } from 'vue';
import axios from 'axios';

// Convertit la clé VAPID publique (base64url) en Uint8Array pour pushManager.subscribe
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function usePush() {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const subscribed = ref(false);
  const busy = ref(false);
  const error = ref('');

  async function refresh() {
    if (!supported) return;
    const reg = await navigator.serviceWorker.ready;
    subscribed.value = !!(await reg.pushManager.getSubscription());
  }

  async function enable() {
    error.value = '';
    if (!supported) { error.value = "Les notifications ne sont pas supportées sur cet appareil/navigateur."; return; }
    busy.value = true;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { error.value = 'Permission refusée. Activez les notifications dans les réglages du navigateur.'; return; }
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = (await axios.get('/api/push/vapid-public-key')).data;
      if (!publicKey) { error.value = 'Le service de notifications n’est pas encore configuré.'; return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      await axios.post('/api/push/subscribe', { endpoint: sub.endpoint, keys: json.keys });
      subscribed.value = true;
    } catch (e) {
      error.value = e?.response?.data?.error || e.message || "Erreur lors de l'activation.";
    } finally {
      busy.value = false;
    }
  }

  async function disable() {
    error.value = '';
    busy.value = true;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await axios.delete('/api/push/subscribe', { data: { endpoint: sub.endpoint } }).catch(() => {});
        await sub.unsubscribe();
      }
      subscribed.value = false;
    } catch (e) {
      error.value = e.message || 'Erreur.';
    } finally {
      busy.value = false;
    }
  }

  return { supported, subscribed, busy, error, refresh, enable, disable };
}
