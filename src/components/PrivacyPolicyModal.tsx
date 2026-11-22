import React from 'react';
import { Lock, ShieldCheck, X } from 'lucide-react';

interface PrivacyPolicyModalProps {
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-policy-title"
    >
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-emerald-300" aria-hidden="true" />
            <h2 id="privacy-policy-title" className="font-display text-2xl font-bold tracking-wide text-white">
              On-Device Privacy Policy
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close privacy policy"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3.5 text-xs leading-relaxed text-slate-200 sm:text-sm">
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3.5">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
            <p className="text-emerald-100">
              <strong>100% On-Device Storage:</strong> Your email, username, gender, country, and
              match records never leave your browser and are never transmitted to any external
              server.
            </p>
          </div>

          <p>
            <strong>Cryptographic Password Hashing:</strong> Plain-text passwords are never saved.
            Before storing your profile in local device storage, ArenaX generates a unique random
            128-bit salt and hashes your password using the browser&apos;s native{' '}
            <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-amber-200">
              Web Crypto SHA-256
            </code>{' '}
            API.
          </p>

          <p>
            <strong>Full User Control:</strong> All game progress and profile data live strictly in
            your browser&apos;s <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px]">localStorage</code>.
            Clearing your browser site data permanently removes your local profiles.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-[44px] w-full rounded-xl bg-[#F5C451] py-2.5 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472]"
        >
          Understood
        </button>
      </div>
    </div>
  );
};
