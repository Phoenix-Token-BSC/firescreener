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

export interface AlertToastData {
  id: string;
  message: string;
  direction: 'up' | 'down';
  price: number;
  tokenSymbol: string;
  chain: string;
  contractAddress: string;
}

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
  } catch {
    // localStorage unavailable
  }
}

export function usePriceAlerts(
  chain: string | null,
  contractAddress: string | null,
  tokenSymbol: string,
  currentPrice?: string | number,
) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [toasts, setToasts] = useState<AlertToastData[]>([]);
  const ablyRef = useRef<Ably.Realtime | null>(null);
  // keep a ref so the Ably callback always sees fresh alert state
  const alertsRef = useRef<PriceAlert[]>([]);
  alertsRef.current = alerts;

  // Hydrate alerts from localStorage on mount
  useEffect(() => {
    if (!chain || !contractAddress) return;
    setAlerts(loadAlerts(chain, contractAddress));
  }, [chain, contractAddress]);

  const fireAlerts = useCallback(
    (price: number) => {
      if (!chain || !contractAddress || isNaN(price) || price <= 0) return;

      const triggered: string[] = [];
      const newToasts: AlertToastData[] = [];

      alertsRef.current.forEach((alert) => {
        if (alert.triggered) return;
        const hit =
          alert.type === 'price_above'
            ? price >= alert.threshold
            : price <= alert.threshold;
        if (!hit) return;

        triggered.push(alert.id);
        newToasts.push({
          id: crypto.randomUUID(),
          message:
            alert.type === 'price_above'
              ? `${alert.tokenSymbol} is now above $${alert.threshold}`
              : `${alert.tokenSymbol} dropped below $${alert.threshold}`,
          direction: alert.type === 'price_above' ? 'up' : 'down',
          price,
          tokenSymbol: alert.tokenSymbol,
          chain,
          contractAddress,
        });
      });

      if (triggered.length === 0) return;

      setAlerts((prev) => {
        const updated = prev.map((a) =>
          triggered.includes(a.id) ? { ...a, triggered: true } : a,
        );
        persistAlerts(chain, contractAddress, updated);
        return updated;
      });
      setToasts((prev) => [...prev, ...newToasts]);
    },
    [chain, contractAddress],
  );

  // Check alerts whenever the polling price changes
  useEffect(() => {
    const price = parseFloat(String(currentPrice));
    fireAlerts(price);
  }, [currentPrice, fireAlerts]);

  // Subscribe to Ably for real-time price pushes from the server worker
  useEffect(() => {
    if (!chain || !contractAddress || !process.env.NEXT_PUBLIC_ABLY_ENABLED) {
      return;
    }

    const ably = new Ably.Realtime({ authUrl: '/api/ably/auth' });
    ablyRef.current = ably;

    const channelName = `price-updates:${chain}:${contractAddress.toLowerCase()}`;
    const channel = ably.channels.get(channelName);

    channel.subscribe('price-update', (msg) => {
      const price = parseFloat(msg.data?.price);
      fireAlerts(price);
    });

    return () => {
      channel.unsubscribe();
      ably.close();
      ablyRef.current = null;
    };
  }, [chain, contractAddress, fireAlerts]);

  const addAlert = useCallback(
    (type: PriceAlert['type'], threshold: number) => {
      if (!chain || !contractAddress) return;
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
    [chain, contractAddress, tokenSymbol],
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

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { alerts, toasts, addAlert, removeAlert, resetTriggered, dismissToast };
}
