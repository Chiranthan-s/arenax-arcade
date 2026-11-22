import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-[#0A291D]/95 px-3.5 py-2 text-xs font-medium text-amber-200 shadow-lg backdrop-blur-md"
    >
      <WifiOff className="h-3.5 w-3.5 text-[#F5C451]" aria-hidden="true" />
      <span>Offline Mode · Ready to Play</span>
    </div>
  );
};
