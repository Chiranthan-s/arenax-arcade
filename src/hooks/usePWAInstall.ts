import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallPlatform = 'ios' | 'android' | 'desktop';

interface PWAInstallSnapshot {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  platform: InstallPlatform;
  isInAppBrowser: boolean;
  offlineReady: boolean;
}

const listeners = new Set<() => void>();
let initialized = false;

function checkStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function detectPlatform(): { platform: InstallPlatform; isInAppBrowser: boolean } {
  if (typeof window === 'undefined') {
    return { platform: 'desktop', isInAppBrowser: false };
  }
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(ua);
  const isInAppBrowser = /instagram|fbav|fban|whatsapp|line|micromessenger|snapchat|wv\)/.test(ua);

  return {
    platform: isIOS ? 'ios' : isAndroid ? 'android' : 'desktop',
    isInAppBrowser,
  };
}

const detected = detectPlatform();

let snapshot: PWAInstallSnapshot = {
  deferredPrompt: null,
  isInstalled: checkStandalone(),
  platform: detected.platform,
  isInAppBrowser: detected.isInAppBrowser,
  offlineReady:
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    Boolean(navigator.serviceWorker.controller),
};

function notify() {
  listeners.forEach((fn) => fn());
}

export function markOfflineReady(): void {
  if (snapshot.offlineReady) return;
  snapshot = { ...snapshot, offlineReady: true };
  notify();
}

function handleBeforeInstallPrompt(e: Event) {
  e.preventDefault();
  snapshot = {
    ...snapshot,
    deferredPrompt: e as BeforeInstallPromptEvent,
  };
  notify();
}

function handleAppInstalled() {
  snapshot = {
    ...snapshot,
    deferredPrompt: null,
    isInstalled: true,
  };
  notify();
}

function handleDisplayModeChange(e: MediaQueryListEvent) {
  snapshot = {
    ...snapshot,
    isInstalled: e.matches || checkStandalone(),
  };
  notify();
}

/**
 * Registers global beforeinstallprompt / appinstalled / display-mode / SW-ready listeners
 * once at app startup so install and offline state are never missed.
 */
export function initGlobalPWAInstallListeners(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const info = detectPlatform();
  snapshot = {
    ...snapshot,
    isInstalled: checkStandalone(),
    platform: info.platform,
    isInAppBrowser: info.isInAppBrowser,
    offlineReady:
      snapshot.offlineReady ||
      ('serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller)),
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(() => {
        markOfflineReady();
      })
      .catch(() => {
        // Ignore SW readiness errors in restricted environments
      });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      markOfflineReady();
    });
  }

  const mq = window.matchMedia('(display-mode: standalone)');
  if (mq.addEventListener) {
    mq.addEventListener('change', handleDisplayModeChange);
  }
}

export interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  platform: InstallPlatform;
  isInAppBrowser: boolean;
  offlineReady: boolean;
  install: () => Promise<{ triggeredNative: boolean; accepted: boolean }>;
}

export function usePWAInstall(): PWAInstallState {
  const [state, setState] = useState<PWAInstallSnapshot>(() => {
    initGlobalPWAInstallListeners();
    return snapshot;
  });

  useEffect(() => {
    initGlobalPWAInstallListeners();
    const update = () => setState({ ...snapshot });
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);

  const install = useCallback(async () => {
    const promptEvent = snapshot.deferredPrompt;
    if (!promptEvent) {
      return { triggeredNative: false, accepted: false };
    }

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      snapshot = {
        ...snapshot,
        deferredPrompt: null,
        isInstalled: outcome === 'accepted' ? true : checkStandalone(),
      };
      notify();
      return { triggeredNative: true, accepted: outcome === 'accepted' };
    } catch {
      snapshot = {
        ...snapshot,
        deferredPrompt: null,
      };
      notify();
      return { triggeredNative: false, accepted: false };
    }
  }, []);

  return {
    isInstallable: !!state.deferredPrompt,
    isInstalled: state.isInstalled,
    isIOS: state.platform === 'ios',
    platform: state.platform,
    isInAppBrowser: state.isInAppBrowser,
    offlineReady: state.offlineReady,
    install,
  };
}
