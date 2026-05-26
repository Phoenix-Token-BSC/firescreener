'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import OneSignal from 'react-onesignal';

export interface PriceAlert {
  id: string;
  type: 'price_above' | 'price_below';
  threshold: number;
  tokenSymbol: string;
  triggered: boolean;
  createdAt: number;
}

export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

interface SupabaseAlertRow {
  id: string;
  type: 'price_above' | 'price_below';
  threshold: number;
  token_symbol: string;
  triggered: boolean;
  created_at: string;
}

function mapAlert(row: SupabaseAlertRow): PriceAlert {
  return {
    id: row.id,
    type: row.type,
    threshold: Number(row.threshold),
    tokenSymbol: row.token_symbol,
    triggered: row.triggered,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// Stable device identifier — generated once per browser, lives in localStorage.
// Used as the Supabase row key so alerts work even before OneSignal is ready.
function getDeviceId(): string {
  const key = 'fs-device-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function fmtPrice(price: number) {
  if (price < 0.0001) return price.toExponential(4);
  if (price < 1) return price.toFixed(8);
  return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

async function showLocalNotification(
  title: string,
  body: string,
  tag: string,
  url: string,
  iconUrl: string,
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const options: NotificationOptions = {
    body,
    icon: iconUrl,
    badge: '/favicon.ico',
    tag,
    data: { url },
    requireInteraction: true,
  };

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (reg) {
        await reg.showNotification(title, options);
        return;
      }
    } catch {}
  }
  new Notification(title, options);
}

export function usePriceAlerts(
  chain: string | null,
  contractAddress: string | null,
  tokenSymbol: string,
  currentPrice?: string | number,
) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [notifPermission, setNotifPermission] = useState<NotifPermission>('default');
  // deviceId is the stable Supabase key — always available after mount.
  const [deviceId, setDeviceId] = useState<string | null>(null);
  // oneSignalId is the push token — may be null until OneSignal initialises.
  const [oneSignalId, setOneSignalId] = useState<string | null>(null);
  const alertsRef = useRef<PriceAlert[]>([]);
  alertsRef.current = alerts;

  // Initialise deviceId from localStorage and read notification permission.
  useEffect(() => {
    setDeviceId(getDeviceId());
    if (!('Notification' in window)) {
      setNotifPermission('unsupported');
    } else {
      setNotifPermission(Notification.permission as NotifPermission);
    }
  }, []);

  // Sync OneSignal subscription ID separately — doesn't block alert creation.
  useEffect(() => {
    function syncOneSignal() {
      try {
        const id = OneSignal.User?.PushSubscription?.id ?? null;
        setOneSignalId(id);
      } catch {}
    }
    syncOneSignal();
    try {
      OneSignal.User.PushSubscription.addEventListener('change', syncOneSignal);
      return () => OneSignal.User.PushSubscription.removeEventListener('change', syncOneSignal);
    } catch {
      return undefined;
    }
  }, []);

  // When OneSignal subscription ID becomes available, link it to all existing
  // alerts for this device so the cron worker can deliver push notifications.
  useEffect(() => {
    if (!deviceId || !oneSignalId) return;
    fetch('/api/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, pushToken: oneSignalId }),
    }).catch(() => {});
  }, [deviceId, oneSignalId]);

  // Load alerts from Supabase whenever chain, address, or deviceId changes.
  useEffect(() => {
    if (!chain || !contractAddress || !deviceId) return;
    fetch(
      `/api/alerts?deviceId=${deviceId}&chain=${chain}&address=${contractAddress.toLowerCase()}`,
    )
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows)) setAlerts(rows.map(mapAlert));
      })
      .catch(() => {});
  }, [chain, contractAddress, deviceId]);

  const fireAlerts = useCallback(
    (price: number) => {
      if (!chain || !contractAddress || isNaN(price) || price <= 0) return;

      const triggered: string[] = [];

      alertsRef.current.forEach((alert) => {
        if (alert.triggered) return;
        const hit =
          alert.type === 'price_above'
            ? price >= alert.threshold
            : price <= alert.threshold;
        if (!hit) return;

        triggered.push(alert.id);

        const direction = alert.type === 'price_above' ? '↑' : '↓';
        const title = `${direction} ${alert.tokenSymbol} Price Alert`;
        const body =
          alert.type === 'price_above'
            ? `Price crossed above $${alert.threshold} — now $${fmtPrice(price)}`
            : `Price dropped below $${alert.threshold} — now $${fmtPrice(price)}`;

        showLocalNotification(
          title,
          body,
          `price-alert-${alert.id}`,
          `${window.location.origin}/${chain}/${contractAddress}`,
          `${window.location.origin}/api/${chain}/logo/${contractAddress}`,
        );

        // Tell the server the alert fired so the cron worker doesn't double-send.
        if (deviceId) {
          fetch(`/api/alerts/${alert.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-device-id': deviceId,
            },
            body: JSON.stringify({ triggered: true }),
          }).catch(() => {});
        }
      });

      if (triggered.length === 0) return;
      setAlerts((prev) =>
        prev.map((a) => (triggered.includes(a.id) ? { ...a, triggered: true } : a)),
      );
    },
    [chain, contractAddress, deviceId],
  );

  useEffect(() => {
    const price = parseFloat(String(currentPrice));
    fireAlerts(price);
  }, [currentPrice, fireAlerts]);

  const requestPermission = useCallback(async (): Promise<NotifPermission> => {
    if (!('Notification' in window)) return 'unsupported';
    try {
      // Try OneSignal first — gets push subscription + browser permission together.
      await Promise.race([
        OneSignal.User.PushSubscription.optIn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('onesignal-timeout')), 15_000),
        ),
      ]);
      try {
        const id = OneSignal.User?.PushSubscription?.id;
        if (id) setOneSignalId(id);
      } catch {}
    } catch {
      // OneSignal failed or timed out — native permission still works for local notifications.
      try { await Notification.requestPermission(); } catch {}
    }
    const perm = Notification.permission as NotifPermission;
    setNotifPermission(perm);
    return perm;
  }, []);

  const addAlert = useCallback(
    async (type: PriceAlert['type'], threshold: number) => {
      if (!chain || !contractAddress || !deviceId) return;

      let permission = notifPermission;
      if (permission === 'default') {
        permission = await requestPermission();
      }
      if (permission !== 'granted') return;

      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          pushToken: oneSignalId,   // may be null — that's fine
          chain,
          contractAddress,
          tokenSymbol,
          type,
          threshold,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      const row: SupabaseAlertRow = await res.json();
      setAlerts((prev) => [...prev, mapAlert(row)]);
    },
    [chain, contractAddress, deviceId, oneSignalId, tokenSymbol, notifPermission, requestPermission],
  );

  const removeAlert = useCallback(
    (id: string) => {
      if (!deviceId) return;
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      fetch(`/api/alerts/${id}`, {
        method: 'DELETE',
        headers: { 'x-device-id': deviceId },
      }).catch(() => {});
    },
    [deviceId],
  );

  const resetTriggered = useCallback(
    async (id: string) => {
      if (!deviceId) return;
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({ triggered: false }),
      });
      if (!res.ok) return;
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, triggered: false } : a)));
    },
    [deviceId],
  );

  return {
    alerts,
    notifPermission,
    requestPermission,
    addAlert,
    removeAlert,
    resetTriggered,
  };
}
