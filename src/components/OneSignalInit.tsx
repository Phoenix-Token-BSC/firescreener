'use client';
import { useEffect } from 'react';
import OneSignal from 'react-onesignal';

export default function OneSignalInit() {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId) return;
    OneSignal.init({
      appId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      notifyButton: { enable: false } as any,
      serviceWorkerPath: '/OneSignalSDKWorker.js',
    }).catch(() => {});
  }, []);

  return null;
}
