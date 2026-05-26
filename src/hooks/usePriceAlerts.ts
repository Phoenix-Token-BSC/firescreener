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

  // Prefer SW notification so notificationclick fires (OneSignal SW handles the click).
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
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const alertsRef = useRef<PriceAlert[]>([]);
  alertsRef.current = alerts;

  // Sync OneSignal subscription ID and notification permission state.
  useEffect(() => {
    function sync() {
      try {
        setSubscriptionId(OneSignal.User?.PushSubscription?.id ?? null);
      } catch {}
      if (!('Notification' in window)) {
        setNotifPermission('unsupported');
      } else {
        setNotifPermission(Notification.permission as NotifPermission);
      }
    }

    sync();
    try {
      OneSignal.User.PushSubscription.addEventListener('change', sync);
      return () => OneSignal.User.PushSubscription.removeEventListener('change', sync);
    } catch {
      return undefined;
    }
  }, []);

  // Load alerts from Supabase whenever chain, address, or subscription changes.
  useEffect(() => {
    if (!chain || !contractAddress || !subscriptionId) return;
    fetch(
      `/api/alerts?subscriptionId=${subscriptionId}&chain=${chain}&address=${contractAddress.toLowerCase()}`,
    )
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows)) setAlerts(rows.map(mapAlert));
      })
      .catch(() => {});
  }, [chain, contractAddress, subscriptionId]);

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

        showLocalNotification(title, body, tag, url, icon);

        // Tell the server the alert fired so the cron worker doesn't double-send.
        const subId = subscriptionId;
        if (subId) {
          fetch(`/api/alerts/${alert.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-subscription-id': subId,
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
    [chain, contractAddress, subscriptionId],
  );

  // Check alerts on every polling tick.
  useEffect(() => {
    const price = parseFloat(String(currentPrice));
    fireAlerts(price);
  }, [currentPrice, fireAlerts]);

  const requestPermission = useCallback(async (): Promise<NotifPermission> => {
    if (!('Notification' in window)) return 'unsupported';
    try {
      // optIn() requests browser permission AND creates the OneSignal subscription.
      await OneSignal.User.PushSubscription.optIn();
      // Poll until the subscription ID is available (OneSignal assigns it async).
      for (let i = 0; i < 10; i++) {
        const id = OneSignal.User?.PushSubscription?.id;
        if (id) { setSubscriptionId(id); break; }
        await new Promise((r) => setTimeout(r, 500));
      }
      const perm = Notification.permission as NotifPermission;
      setNotifPermission(perm);
      return perm;
    } catch {
      return 'unsupported';
    }
  }, []);

  const addAlert = useCallback(
    async (type: PriceAlert['type'], threshold: number) => {
      if (!chain || !contractAddress) return;

      let permission = notifPermission;
      if (permission === 'default') {
        permission = await requestPermission();
      }
      if (permission !== 'granted') return;

      // Read from singleton in case requestPermission() just set it.
      const subId = OneSignal.User?.PushSubscription?.id ?? subscriptionId;
      if (!subId) return;

      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: subId,
          chain,
          contractAddress,
          tokenSymbol,
          type,
          threshold,
        }),
      });

      if (!res.ok) return;
      const row: SupabaseAlertRow = await res.json();
      setAlerts((prev) => [...prev, mapAlert(row)]);
    },
    [chain, contractAddress, subscriptionId, tokenSymbol, notifPermission, requestPermission],
  );

  const removeAlert = useCallback(
    (id: string) => {
      const subId = subscriptionId;
      if (!subId) return;
      // Optimistic removal — fire-and-forget server delete.
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      fetch(`/api/alerts/${id}`, {
        method: 'DELETE',
        headers: { 'x-subscription-id': subId },
      }).catch(() => {});
    },
    [subscriptionId],
  );

  const resetTriggered = useCallback(
    async (id: string) => {
      const subId = subscriptionId;
      if (!subId) return;
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-subscription-id': subId,
        },
        body: JSON.stringify({ triggered: false }),
      });
      if (!res.ok) return;
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, triggered: false } : a)));
    },
    [subscriptionId],
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
