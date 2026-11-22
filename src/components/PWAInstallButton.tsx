import React, { useMemo, useState } from 'react';
import {
  Download,
  Monitor,
  MoreVertical,
  PlusCircle,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { InstallPlatform, PWAInstallState, usePWAInstall } from '../hooks/usePWAInstall';
import { soundFX } from '../engine/soundFX';

interface PWAInstallButtonProps {
  installState?: PWAInstallState;
}

interface GuideCard {
  id: InstallPlatform;
  title: string;
  badge: string;
  step1: React.ReactNode;
  step2: React.ReactNode;
  icon: React.ReactNode;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ installState }) => {
  const hookState = usePWAInstall();
  const state = installState ?? hookState;
  const [showGuide, setShowGuide] = useState(false);

  const orderedGuides = useMemo<GuideCard[]>(() => {
    const guides: GuideCard[] = [
      {
        id: 'android',
        title: 'Android Chrome',
        badge: 'Mobile',
        icon: <Smartphone className="h-4 w-4 text-emerald-300" aria-hidden="true" />,
        step1: (
          <span>
            Tap{' '}
            <span className="inline-flex items-center rounded border border-white/15 bg-white/10 px-1.5 py-0.5 font-bold text-white">
              <MoreVertical className="mr-0.5 inline h-3 w-3" aria-hidden="true" />⋮
            </span>{' '}
            in the top-right corner of Chrome.
          </span>
        ),
        step2: (
          <span>
            Tap <strong>Install App</strong> or <strong>Add to Home Screen</strong>.
          </span>
        ),
      },
      {
        id: 'ios',
        title: 'iPhone / iPad Safari',
        badge: 'iOS',
        icon: <Share className="h-4 w-4 text-cyan-300" aria-hidden="true" />,
        step1: (
          <span>
            Tap the{' '}
            <span className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/10 px-1.5 py-0.5 font-bold text-white">
              Share <span aria-hidden="true">⎋</span>
            </span>{' '}
            button in Safari&apos;s toolbar.
          </span>
        ),
        step2: (
          <span>
            Scroll down and tap <strong>Add to Home Screen</strong>.
          </span>
        ),
      },
      {
        id: 'desktop',
        title: 'PC Chrome / Edge (Windows & Mac)',
        badge: 'Desktop',
        icon: <Monitor className="h-4 w-4 text-[#F5C451]" aria-hidden="true" />,
        step1: (
          <span>
            Click the{' '}
            <span className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/10 px-1.5 py-0.5 font-bold text-white">
              <PlusCircle className="h-3 w-3 text-[#F5C451]" aria-hidden="true" />
              <span>Install ⊕</span>
            </span>{' '}
            icon in the top-right address bar.
          </span>
        ),
        step2: (
          <span>
            Click <strong>Install</strong> to launch ArenaX in its own desktop window.
          </span>
        ),
      },
    ];

    // Put the user's detected platform first
    return [
      ...guides.filter((g) => g.id === state.platform),
      ...guides.filter((g) => g.id !== state.platform),
    ];
  }, [state.platform]);

  // Hide only when already running in standalone installed mode
  if (state.isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    soundFX.playTap();
    if (state.isInstallable) {
      const result = await state.install();
      if (result.triggeredNative) {
        return;
      }
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#F5C451] px-2.5 py-1.5 text-xs font-bold text-[#051610] shadow-[0_0_16px_rgba(245,196,81,0.38)] ring-1 ring-amber-200/50 transition hover:bg-[#fbd472] hover:shadow-[0_0_22px_rgba(245,196,81,0.55)] active:scale-[0.97] whitespace-nowrap shrink-0 sm:px-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5C451]"
      >
        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Install App</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-guide-title"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="glass-panel max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-[#F5C451] uppercase">
                  Offline-Ready PWA
                </p>
                <h3
                  id="install-guide-title"
                  className="font-display mt-0.5 text-2xl font-bold tracking-wide text-white"
                >
                  How to Install ArenaX
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install instructions"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {state.isInAppBrowser && (
              <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3.5 py-2.5 text-xs leading-relaxed text-amber-100">
                Opened inside an in-app browser? Tap the menu to <strong>Open in Chrome</strong>{' '}
                (Android) or <strong>Open in Safari</strong> (iPhone) to install cleanly.
              </div>
            )}

            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              Install once to play Hand Cricket, Neon Carrom, and Curve-Shot Penalty Duel full-screen
              and 100% offline.
            </p>

            <div className="mt-4 space-y-3">
              {orderedGuides.map((guide, index) => {
                const isDetected = index === 0;
                return (
                  <div
                    key={guide.id}
                    className={`rounded-xl border p-3.5 ${
                      isDetected
                        ? 'border-[#F5C451]/60 bg-[#F5C451]/10'
                        : 'border-white/10 bg-black/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {guide.icon}
                        <h4 className="text-sm font-bold text-white">{guide.title}</h4>
                      </div>
                      <span
                        className={`text-[11px] font-semibold ${
                          isDetected ? 'text-[#F5C451]' : 'text-slate-400'
                        }`}
                      >
                        {isDetected ? 'Your Device' : guide.badge}
                      </span>
                    </div>

                    <ol className="mt-2.5 space-y-2 text-xs leading-relaxed text-slate-200">
                      <li className="flex items-start gap-2">
                        <span className="font-mono-tabular flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/10 text-[11px] font-bold text-[#F5C451]">
                          1
                        </span>
                        <div>{guide.step1}</div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-mono-tabular flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white/10 text-[11px] font-bold text-[#F5C451]">
                          2
                        </span>
                        <div>{guide.step2}</div>
                      </li>
                    </ol>
                  </div>
                );
              })}
            </div>

            {state.isInstallable && (
              <button
                type="button"
                onClick={async () => {
                  const res = await state.install();
                  if (res.accepted) setShowGuide(false);
                }}
                className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-[#03120C] transition hover:bg-emerald-400"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Install Now</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-3 min-h-[44px] w-full rounded-xl bg-[#F5C451] py-2.5 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
