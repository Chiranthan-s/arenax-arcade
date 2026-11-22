import React, { useCallback, useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { soundFX } from '../engine/soundFX';

interface WhatsAppChallengeButtonProps {
  username: string;
  countryFlag: string;
  gameTitle: string;
  scoreSummary: string;
  scoreToBeat: string;
}

export const WhatsAppChallengeButton: React.FC<WhatsAppChallengeButtonProps> = ({
  username,
  countryFlag,
  gameTitle,
  scoreSummary,
  scoreToBeat,
}) => {
  const [copied, setCopied] = useState(false);

  const liveUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const message = [
    `${countryFlag} ${username} · ArenaX Challenge!`,
    `Game: ${gameTitle}`,
    `${scoreSummary}`,
    `Score to beat: ${scoreToBeat}`,
    `Think you can beat me? Play now: ${liveUrl}`,
  ].join('\n');

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  const handleCopy = useCallback(async () => {
    soundFX.playTap();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        const ta = document.createElement('textarea');
        ta.value = message;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2600);
    } catch {
      setCopied(false);
    }
  }, [message]);

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleCopy}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-[#03120C] transition hover:bg-emerald-400 active:scale-[0.98]"
        >
          <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Challenge Friend on WhatsApp</span>
        </a>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy formatted scorecard"
          title="Copy scorecard"
          className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-white/15 bg-white/10 px-3 text-slate-100 transition hover:bg-white/15 active:scale-[0.98]"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {copied && (
        <p
          role="status"
          aria-live="polite"
          className="text-center text-xs font-medium text-emerald-300"
        >
          Scorecard copied to clipboard · Ready to share on WhatsApp!
        </p>
      )}
    </div>
  );
};
