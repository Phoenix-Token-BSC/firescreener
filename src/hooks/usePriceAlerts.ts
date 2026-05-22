'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as Ably from 'ably';

export interface PriceAlert {
  id: string;
  type: 'price_above' | 'price_below';
  threshold: number;
  tokenSymbol: string;
  triggered: boolean;
  createdAt: number;
}

export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

const STORAGE_KEY = 'fs-price-alerts';

function storageKey(chain: string, address: string) {
  return `${chain}:${address.toLowerCase()}`;
}

function loadAlerts(chain: string, address: string): PriceAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: Record<string, PriceAlert[]> = raw ? JSON.parse(raw) : {};
    return all[storageKey(chain, address)] ?? [];
  } catch {
    return [];
  }
}

function persistAlerts(chain: string, address: string, alerts: PriceAlert[]) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: Record<string, PriceAlert[]> = raw ? JSON.parse(raw) : {};
    all[storageKey(chain, address)] = alerts;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

function fmtPrice(price: number) {
  if (price < 0.0001) return price.toExponential(4);
  if (price < 1) return price.toFixed(8);
  return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

async function showPushNotification(
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
    // keep on screen until user interacts
    requireInteraction: true,
  };

  // Prefer service-worker notification so notificationclick fires
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      return;
    } catch {}
  }
  // Fallback: direct Notification (no click-to-open, but still shows)
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
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const alertsRef = useRef<PriceAlert[]>([]);
  alertsRef.current = alerts;

  // Register service worker once on mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    if (!('Notification' in window)) {
      setNotifPermission('unsupported');
    } else {
      setNotifPermission(Notification.permission as NotifPermission);
    }
  }, []);

  // Hydrate alerts from localStorage
  useEffect(() => {
    if (!chain || !contractAddress) return;
    setAlerts(loadAlerts(chain, contractAddress));
  }, [chain, contractAddress]);

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
        const tag = `price-alert-${alert.id}`;
        const url = `${window.location.origin}/${chain}/${contractAddress}`;
        const icon = `${window.location.origin}/api/${chain}/logo/${contractAddress}`;

        showPushNotification(title, body, tag, url, icon);
      });

      if (triggered.length === 0) return;

      setAlerts((prev) => {
        const updated = prev.map((a) =>
          triggered.includes(a.id) ? { ...a, triggered: true } : a,
        );
        persistAlerts(chain, contractAddress, updated);
        return updated;
      });
    },
    [chain, contractAddress],
  );

  // Check alerts on every polling tick
  useEffect(() => {
    const price = parseFloat(String(currentPrice));
    fireAlerts(price);
  }, [currentPrice, fireAlerts]);

  // Subscribe to Ably for real-time price pushes from the server worker
  useEffect(() => {
    if (!chain || !contractAddress || !process.env.NEXT_PUBLIC_ABLY_ENABLED) return;

    const ably = new Ably.Realtime({ authUrl: '/api/ably/auth' });
    ablyRef.current = ably;

    const channel = ably.channels.get(
      `price-updates:${chain}:${contractAddress.toLowerCase()}`,
    );
    channel.subscribe('price-update', (msg) => {
      fireAlerts(parseFloat(msg.data?.price));
    });

    return () => {
      channel.unsubscribe();
      ably.close();
      ablyRef.current = null;
    };
  }, [chain, contractAddress, fireAlerts]);

  const requestPermission = useCallback(async (): Promise<NotifPermission> => {
    if (!('Notification' in window)) return 'unsupported';
    const result = await Notification.requestPermission();
    setNotifPermission(result as NotifPermission);
    return result as NotifPermission;
  }, []);

  const addAlert = useCallback(
    async (type: PriceAlert['type'], threshold: number) => {
      if (!chain || !contractAddress) return;

      // Ensure permission is granted before saving the alert
      let permission = notifPermission;
      if (permission === 'default') {
        permission = await requestPermission();
      }
      if (permission !== 'granted') return;

      const alert: PriceAlert = {
        id: crypto.randomUUID(),
        type,
        threshold,
        tokenSymbol,
        triggered: false,
        createdAt: Date.now(),
      };
      setAlerts((prev) => {
        const updated = [...prev, alert];
        persistAlerts(chain, contractAddress, updated);
        return updated;
      });
    },
    [chain, contractAddress, tokenSymbol, notifPermission, requestPermission],
  );

  const removeAlert = useCallback(
    (id: string) => {
      if (!chain || !contractAddress) return;
      setAlerts((prev) => {
        const updated = prev.filter((a) => a.id !== id);
        persistAlerts(chain, contractAddress, updated);
        return updated;
      });
    },
    [chain, contractAddress],
  );

  const resetTriggered = useCallback(
    (id: string) => {
      if (!chain || !contractAddress) return;
      setAlerts((prev) => {
        const updated = prev.map((a) =>
          a.id === id ? { ...a, triggered: false } : a,
        );
        persistAlerts(chain, contractAddress, updated);
        return updated;
      });
    },
    [chain, contractAddress],
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
