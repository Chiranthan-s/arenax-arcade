import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  PowerOff,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ActivePlayerProfile,
  changeUserPassword,
  deactivateUserAccount,
  deleteUserAccount,
  resetUserGameStats,
} from '../engine/auth';
import { soundFX } from '../engine/soundFX';
import { resetCareerStats } from '../engine/storage';

interface SettingsModalProps {
  profile: ActivePlayerProfile | null;
  onClose: () => void;
  onAccountClosed: () => void;
  onUpgradeGuest: () => void;
  onStatsReset: (updatedProfile: ActivePlayerProfile) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  profile,
  onClose,
  onAccountClosed,
  onUpgradeGuest,
  onStatsReset,
}) => {
  const [muted, setMuted] = useState<boolean>(() => soundFX.isMuted());
  const [volume, setVolume] = useState<number>(() => soundFX.getVolume());

  // Change password state
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdFeedback, setPwdFeedback] = useState<{ type: 'error' | 'ok'; text: string } | null>(
    null
  );
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  // Reset stats & Danger zone confirmations (never window.confirm / window.alert)
  const [resetStatsConfirm, setResetStatsConfirm] = useState(false);
  const [statsResetDone, setStatsResetDone] = useState(false);
  const [dangerConfirm, setDangerConfirm] = useState<'none' | 'deactivate' | 'delete'>('none');

  useEffect(() => {
    return soundFX.subscribe(() => {
      setMuted(soundFX.isMuted());
      setVolume(soundFX.getVolume());
    });
  }, []);

  const handleToggleSound = () => {
    soundFX.toggleMute();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = Number(e.target.value);
    soundFX.setVolume(pct / 100);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || profile.isGuest) return;
    setPwdFeedback(null);

    if (newPassword !== confirmPassword) {
      setPwdFeedback({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setPwdSubmitting(true);
    try {
      const res = await changeUserPassword({
        userId: profile.id,
        currentPassword,
        newPassword,
      });
      if (!res.ok) {
        setPwdFeedback({ type: 'error', text: res.error });
      } else {
        soundFX.playPowerUp();
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPwdFeedback({
          type: 'ok',
          text: 'Password updated with a fresh salted SHA-256 hash.',
        });
      }
    } finally {
      setPwdSubmitting(false);
    }
  };

  const handleConfirmResetStats = () => {
    if (!profile) return;
    soundFX.playTap();
    const updated = resetUserGameStats(profile);
    resetCareerStats();
    onStatsReset(updated);
    setResetStatsConfirm(false);
    setStatsResetDone(true);
  };

  const handleConfirmDeactivate = () => {
    if (!profile || profile.isGuest) return;
    soundFX.playTap();
    deactivateUserAccount(profile.id);
    onAccountClosed();
    onClose();
  };

  const handleConfirmDelete = () => {
    if (!profile || profile.isGuest) return;
    soundFX.playTap();
    deleteUserAccount(profile.id);
    resetCareerStats();
    onAccountClosed();
    onClose();
  };

  const volumePercent = muted ? 0 : Math.round(volume * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onClick={onClose}
    >
      <div
        className="glass-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-[#F5C451] uppercase">
              ArenaX Preferences
            </p>
            <h2
              id="settings-modal-title"
              className="font-display mt-0.5 text-2xl font-bold tracking-wide text-white sm:text-3xl"
            >
              Sound &amp; Account Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFX.playTap();
              onClose();
            }}
            aria-label="Close settings"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {/* 1. Audio & Sound Controls */}
          <section className="rounded-xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {muted ? (
                  <VolumeX className="h-5 w-5 text-slate-400" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-5 w-5 text-[#F5C451]" aria-hidden="true" />
                )}
                <div>
                  <h3 className="text-sm font-bold text-white">Procedural Sound Effects</h3>
                  <p className="text-xs text-slate-400">
                    Web Audio synthesis with dynamic compression
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={!muted}
                onClick={handleToggleSound}
                className={`inline-flex min-h-[36px] min-w-[72px] items-center justify-center rounded-lg px-3 text-xs font-bold transition ${
                  !muted
                    ? 'bg-[#F5C451] text-[#051610]'
                    : 'border border-white/15 bg-white/10 text-slate-300'
                }`}
              >
                {!muted ? 'ON' : 'MUTED'}
              </button>
            </div>

            <div className="mt-4 space-y-2 border-t border-white/10 pt-3.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="master-volume-slider" className="font-semibold text-slate-200">
                  Master Volume
                </label>
                <span className="font-mono-tabular font-bold text-[#F5C451]">
                  {volumePercent}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="master-volume-slider"
                  type="range"
                  min={0}
                  max={100}
                  value={volumePercent}
                  onChange={handleVolumeChange}
                  onPointerUp={() => {
                    if (!soundFX.isMuted()) soundFX.playTap();
                  }}
                  className="h-2.5 flex-1 cursor-pointer accent-[#F5C451]"
                />
                <button
                  type="button"
                  onClick={() => soundFX.playPowerUp()}
                  disabled={muted || volumePercent === 0}
                  className="min-h-[34px] rounded-lg border border-white/15 bg-white/10 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/15 disabled:opacity-40"
                >
                  Test Audio
                </button>
              </div>
            </div>
          </section>

          {/* 2. Profile & Credentials */}
          {profile ? (
            profile.isGuest ? (
              <>
              <section className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">Guest Session Active</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      You&apos;re playing as <strong>Guest Pro</strong> ({profile.countryFlag}{' '}
                      {profile.countryName}). Create a local encrypted account to save your wins,
                      streaks, and password permanently on this device.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playTap();
                    onUpgradeGuest();
                    onClose();
                  }}
                  className="mt-3.5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#F5C451] px-4 py-2.5 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472]"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  <span>Register / Upgrade Account</span>
                </button>
              </section>

              <section className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">Game Statistics</h3>
                    <p className="text-xs text-slate-400">
                      Clear local wins, points, and win streaks while keeping this session active.
                    </p>
                  </div>
                  {!resetStatsConfirm && (
                    <button
                      type="button"
                      onClick={() => {
                        soundFX.playTap();
                        setStatsResetDone(false);
                        setResetStatsConfirm(true);
                      }}
                      className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3.5 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-500/25"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reset Game Stats</span>
                    </button>
                  )}
                </div>

                {statsResetDone && !resetStatsConfirm && (
                  <p
                    role="status"
                    className="mt-3 flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-200"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>All wins, points, and win streaks have been reset to 0.</span>
                  </p>
                )}

                {resetStatsConfirm && (
                  <div className="mt-3 space-y-2.5 rounded-xl border border-amber-400/40 bg-black/40 p-3">
                    <p className="text-xs font-medium text-amber-100">
                      Reset all your wins, points, and win streaks back to 0?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleConfirmResetStats}
                        className="min-h-[40px] rounded-lg bg-amber-400 px-3 text-xs font-bold text-slate-950 hover:bg-amber-300"
                      >
                        Confirm Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetStatsConfirm(false)}
                        className="min-h-[40px] rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>
              </>
            ) : (
              <>
                <section className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                    <h3 className="text-sm font-bold text-white">Profile &amp; Credentials</h3>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>SHA-256 Protected</span>
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                    <div>
                      <dt className="text-slate-400">Username</dt>
                      <dd className="mt-0.5 font-semibold text-white truncate">
                        {profile.username}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Country</dt>
                      <dd className="mt-0.5 font-semibold text-white truncate">
                        {profile.countryFlag} {profile.countryName}
                      </dd>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <dt className="text-slate-400">Gmail / Email</dt>
                      <dd className="mt-0.5 font-semibold text-white truncate">{profile.email}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Gender</dt>
                      <dd className="mt-0.5 font-semibold text-white">{profile.gender}</dd>
                    </div>
                    <div className="col-span-2 flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5 text-[#F5C451]" aria-hidden="true" />
                        <span className="text-slate-300">Password:</span>
                        <span className="font-mono-tabular tracking-widest text-white">
                          ••••••••
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          soundFX.playTap();
                          setShowPwdForm((v) => !v);
                          setPwdFeedback(null);
                        }}
                        className="inline-flex items-center gap-1 font-bold text-[#F5C451] hover:underline underline-offset-4"
                      >
                        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{showPwdForm ? 'Hide' : 'Change Password'}</span>
                      </button>
                    </div>
                  </dl>

                  {showPwdForm && (
                    <form
                      onSubmit={handlePasswordSubmit}
                      className="mt-4 space-y-3 border-t border-white/10 pt-3.5"
                      noValidate
                    >
                      {pwdFeedback && (
                        <div
                          role={pwdFeedback.type === 'error' ? 'alert' : 'status'}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                            pwdFeedback.type === 'error'
                              ? 'border-red-500/45 bg-red-950/50 text-red-200'
                              : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                          }`}
                        >
                          {pwdFeedback.type === 'ok' && (
                            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                          )}
                          <span>{pwdFeedback.text}</span>
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="settings-cur-pwd"
                          className="block text-[11px] font-semibold text-slate-300"
                        >
                          Current Password
                        </label>
                        <div className="relative mt-1">
                          <input
                            id="settings-cur-pwd"
                            type={showCurrentPwd ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                            className="w-full min-h-[42px] rounded-xl border border-white/15 bg-black/40 pr-10 pl-3 text-xs text-white focus:border-[#F5C451] focus:outline-none sm:text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPwd((s) => !s)}
                            aria-label={showCurrentPwd ? 'Hide current password' : 'Show current password'}
                            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-white"
                          >
                            {showCurrentPwd ? (
                              <EyeOff className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="settings-new-pwd"
                            className="block text-[11px] font-semibold text-slate-300"
                          >
                            New Password (min 6)
                          </label>
                          <div className="relative mt-1">
                            <input
                              id="settings-new-pwd"
                              type={showNewPwd ? 'text' : 'password'}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full min-h-[42px] rounded-xl border border-white/15 bg-black/40 pr-10 pl-3 text-xs text-white focus:border-[#F5C451] focus:outline-none sm:text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPwd((s) => !s)}
                              aria-label={showNewPwd ? 'Hide new password' : 'Show new password'}
                              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-white"
                            >
                              {showNewPwd ? (
                                <EyeOff className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label
                            htmlFor="settings-confirm-pwd"
                            className="block text-[11px] font-semibold text-slate-300"
                          >
                            Confirm New Password
                          </label>
                          <input
                            id="settings-confirm-pwd"
                            type={showNewPwd ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="mt-1 w-full min-h-[42px] rounded-xl border border-white/15 bg-black/40 px-3 text-xs text-white focus:border-[#F5C451] focus:outline-none sm:text-sm"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={pwdSubmitting}
                        className="min-h-[42px] w-full rounded-xl bg-[#F5C451] px-4 py-2 text-xs font-bold text-[#051610] transition hover:bg-[#fbd472] disabled:opacity-50 sm:text-sm"
                      >
                        {pwdSubmitting ? 'Re-Hashing...' : 'Save New Encrypted Password'}
                      </button>
                    </form>
                  )}
                </section>

                {/* Reset Game Stats (directly above Danger Zone) */}
                <section className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white">Game Statistics</h3>
                      <p className="text-xs text-slate-400">
                        Reset wins, points, and win streaks to 0 while keeping your account active.
                      </p>
                    </div>
                    {!resetStatsConfirm && (
                      <button
                        type="button"
                        onClick={() => {
                          soundFX.playTap();
                          setStatsResetDone(false);
                          setResetStatsConfirm(true);
                        }}
                        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3.5 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-500/25"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Reset Game Stats</span>
                      </button>
                    )}
                  </div>

                  {statsResetDone && !resetStatsConfirm && (
                    <p
                      role="status"
                      className="mt-3 flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-200"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>All wins, points, and win streaks have been reset to 0.</span>
                    </p>
                  )}

                  {resetStatsConfirm && (
                    <div className="mt-3 space-y-2.5 rounded-xl border border-amber-400/40 bg-black/40 p-3">
                      <p className="text-xs font-medium text-amber-100">
                        Reset all your wins, points, and win streaks back to 0?
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleConfirmResetStats}
                          className="min-h-[40px] rounded-lg bg-amber-400 px-3 text-xs font-bold text-slate-950 hover:bg-amber-300"
                        >
                          Confirm Reset
                        </button>
                        <button
                          type="button"
                          onClick={() => setResetStatsConfirm(false)}
                          className="min-h-[40px] rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                {/* 3. Danger Zone */}
                <section className="rounded-xl border border-red-500/35 bg-red-950/20 p-4">
                  <div className="flex items-center gap-2 text-red-300">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <h3 className="text-sm font-bold">Danger Zone</h3>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    Deactivate temporarily disables login until you reactivate. Permanent deletion
                    erases your local profile, password hash, and win stats.
                  </p>

                  {dangerConfirm === 'none' && (
                    <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          soundFX.playTap();
                          setDangerConfirm('deactivate');
                        }}
                        className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-500/25"
                      >
                        <PowerOff className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Deactivate Account</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          soundFX.playTap();
                          setDangerConfirm('delete');
                        }}
                        className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-red-500/50 bg-red-500/20 px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/35"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Delete Account Permanently</span>
                      </button>
                    </div>
                  )}

                  {dangerConfirm === 'deactivate' && (
                    <div className="mt-3.5 space-y-2.5 rounded-xl border border-amber-400/40 bg-black/40 p-3">
                      <p className="text-xs font-medium text-amber-100">
                        Deactivate <strong>{profile.username}</strong>? You will be logged out and
                        login will stay disabled until you reactivate on the sign-in screen.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleConfirmDeactivate}
                          className="min-h-[40px] rounded-lg bg-amber-400 px-3 text-xs font-bold text-slate-950 hover:bg-amber-300"
                        >
                          Confirm Deactivate
                        </button>
                        <button
                          type="button"
                          onClick={() => setDangerConfirm('none')}
                          className="min-h-[40px] rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {dangerConfirm === 'delete' && (
                    <div className="mt-3.5 space-y-2.5 rounded-xl border border-red-500/50 bg-black/45 p-3">
                      <p className="text-xs font-medium text-red-100">
                        Permanently delete <strong>{profile.username}</strong> and wipe all local
                        arcade &amp; career stats from this device? This cannot be undone.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleConfirmDelete}
                          className="min-h-[40px] rounded-lg bg-red-500 px-3 text-xs font-bold text-white hover:bg-red-400"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDangerConfirm('none')}
                          className="min-h-[40px] rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </>
            )
          ) : (
            <p className="rounded-xl border border-white/10 bg-black/25 p-4 text-xs text-slate-300">
              Sign in or start Quick Guest Play to manage your local profile credentials, password,
              and account preferences.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
