import React, { useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Play,
  Search,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { COUNTRIES, CountryOption } from '../data/countries';
import {
  ActivePlayerProfile,
  GenderOption,
  loginUser,
  reactivateUserAccount,
  registerUser,
  startGuestSession,
} from '../engine/auth';
import { soundFX } from '../engine/soundFX';

interface AuthGateProps {
  onAuthenticated: (profile: ActivePlayerProfile) => void;
  onOpenPrivacy: () => void;
}

const GENDERS: GenderOption[] = ['Male', 'Female', 'Other', 'Prefer not to say'];

export const AuthGate: React.FC<AuthGateProps> = ({
  onAuthenticated,
  onOpenPrivacy,
}) => {
  const [tab, setTab] = useState<'register' | 'login'>('register');

  // Register fields
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regGender, setRegGender] = useState<GenderOption>('Male');
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(COUNTRIES[0]); // Default India

  // Searchable country dropdown state
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginShowPassword, setLoginShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [deactivatedPrompt, setDeactivatedPrompt] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countryQuery]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await registerUser({
        email: regEmail,
        username: regUsername,
        password: regPassword,
        gender: regGender,
        country: selectedCountry,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        soundFX.playPowerUp();
        onAuthenticated(res.profile);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDeactivatedPrompt(false);
    setSubmitting(true);
    try {
      const res = await loginUser({
        email: loginEmail,
        password: loginPassword,
      });
      if (!res.ok) {
        setError(res.error);
        if (res.deactivated) {
          setDeactivatedPrompt(true);
        }
      } else {
        soundFX.playPowerUp();
        onAuthenticated(res.profile);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReactivate = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await reactivateUserAccount({
        email: loginEmail,
        password: loginPassword,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        soundFX.playPowerUp();
        setDeactivatedPrompt(false);
        onAuthenticated(res.profile);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestPlay = () => {
    soundFX.playTap();
    const guest = startGuestSession();
    onAuthenticated(guest);
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
      {/* Left Intro & Sports Preview */}
      <div className="space-y-5">
        <button
          type="button"
          onClick={onOpenPrivacy}
          className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
        >
          <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          <span>100% On-Device Encrypted Privacy</span>
        </button>

        <div className="space-y-3">
          <h1 className="font-display text-4xl leading-[1.02] font-extrabold tracking-tight text-white [text-wrap:balance] sm:text-5xl">
            ArenaX: Mini-Sports Arcade
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
            Create your local player card once to track arcade wins across{' '}
            <strong className="text-white">Gully Clash Hand Cricket</strong>,{' '}
            <strong className="text-white">Neon Carrom Striker</strong>,{' '}
            <strong className="text-white">Curve-Shot Penalty Duel</strong>, and{' '}
            <strong className="text-white">Royal &amp; Chaos Chess</strong>.
          </p>
        </div>

        <div className="space-y-2.5 border-t border-white/10 pt-4 text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <Lock className="h-4 w-4 shrink-0 text-[#F5C451]" aria-hidden="true" />
            <span>
              Passwords are salted &amp; hashed locally via{' '}
              <strong className="text-slate-100">Web Crypto SHA-256</strong>.
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
            <span>Zero server uploads — everything stays strictly on your device.</span>
          </div>
        </div>
      </div>

      {/* Right Auth Card */}
      <div className="glass-panel rounded-2xl p-5 shadow-2xl sm:p-7">
        {/* Segmented Auth Tabs */}
        <div
          role="tablist"
          aria-label="Player Authentication"
          className="grid grid-cols-2 gap-1 rounded-xl bg-black/35 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'register'}
            onClick={() => {
              soundFX.playTap();
              setTab('register');
              setError(null);
              setDeactivatedPrompt(false);
            }}
            className={`min-h-[42px] rounded-lg px-3 text-xs font-bold transition sm:text-sm ${
              tab === 'register'
                ? 'bg-[#F5C451] text-[#051610] shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            New Player Register
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            onClick={() => {
              soundFX.playTap();
              setTab('login');
              setError(null);
              setDeactivatedPrompt(false);
            }}
            className={`min-h-[42px] rounded-lg px-3 text-xs font-bold transition sm:text-sm ${
              tab === 'login'
                ? 'bg-[#F5C451] text-[#051610] shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Existing Login
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 space-y-2.5 rounded-xl border border-red-500/45 bg-red-950/50 px-3.5 py-2.5 text-xs font-medium text-red-200"
          >
            <p>{error}</p>
            {deactivatedPrompt && (
              <button
                type="button"
                disabled={submitting}
                onClick={handleReactivate}
                className="min-h-[38px] w-full rounded-lg bg-[#F5C451] px-3 py-2 text-xs font-bold text-[#051610] transition hover:bg-[#fbd472] disabled:opacity-60"
              >
                Reactivate Account &amp; Sign In
              </button>
            )}
          </div>
        )}

        {/* REGISTER FORM */}
        {tab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="mt-4 space-y-3.5" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-300">
                  Gmail / Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="player@gmail.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-white/15 bg-black/35 px-3 text-sm text-white placeholder:text-slate-500 focus:border-[#F5C451] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="reg-username" className="block text-xs font-semibold text-slate-300">
                  Username
                </label>
                <input
                  id="reg-username"
                  type="text"
                  required
                  maxLength={18}
                  autoComplete="username"
                  placeholder="Striker99"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-white/15 bg-black/35 px-3 text-sm text-white placeholder:text-slate-500 focus:border-[#F5C451] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-300">
                Password <span className="text-slate-400">(min 6 characters)</span>
              </label>
              <div className="relative mt-1">
                <input
                  id="reg-password"
                  type={regShowPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-white/15 bg-black/35 pr-11 pl-3 text-sm text-white placeholder:text-slate-500 focus:border-[#F5C451] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setRegShowPassword((s) => !s)}
                  aria-label={regShowPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-white"
                >
                  {regShowPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Gender Selector */}
              <div>
                <label htmlFor="reg-gender" className="block text-xs font-semibold text-slate-300">
                  Gender
                </label>
                <select
                  id="reg-gender"
                  value={regGender}
                  onChange={(e) => setRegGender(e.target.value as GenderOption)}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-white/15 bg-[#082218] px-3 text-sm text-white focus:border-[#F5C451] focus:outline-none"
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Searchable Country Dropdown */}
              <div className="relative">
                <span className="block text-xs font-semibold text-slate-300">Country</span>
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={countryDropdownOpen}
                  onClick={() => {
                    const next = !countryDropdownOpen;
                    setCountryDropdownOpen(next);
                    if (next) {
                      window.setTimeout(() => searchInputRef.current?.focus(), 20);
                    }
                  }}
                  className="mt-1 flex w-full min-h-[44px] items-center justify-between gap-2 rounded-xl border border-white/15 bg-[#082218] px-3 text-left text-sm text-white focus:border-[#F5C451] focus:outline-none"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="text-base leading-none" aria-hidden="true">
                      {selectedCountry.flag}
                    </span>
                    <span className="truncate">{selectedCountry.name}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </button>

                {countryDropdownOpen && (
                  <div className="absolute right-0 left-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-white/15 bg-[#071D15] shadow-2xl">
                    <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                      <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search country..."
                        value={countryQuery}
                        onChange={(e) => setCountryQuery(e.target.value)}
                        className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
                      />
                    </div>
                    <ul
                      role="listbox"
                      aria-label="Select country"
                      className="max-h-44 overflow-y-auto p-1"
                    >
                      {filteredCountries.length === 0 ? (
                        <li className="px-3 py-2 text-xs text-slate-400">No country found</li>
                      ) : (
                        filteredCountries.map((c) => (
                          <li key={c.code}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={c.code === selectedCountry.code}
                              onClick={() => {
                                setSelectedCountry(c);
                                setCountryDropdownOpen(false);
                                setCountryQuery('');
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${
                                c.code === selectedCountry.code
                                  ? 'bg-[#F5C451]/20 font-semibold text-[#F5C451]'
                                  : 'text-slate-200 hover:bg-white/10'
                              }`}
                            >
                              <span className="flex items-center gap-2 truncate">
                                <span className="text-base leading-none">{c.flag}</span>
                                <span className="truncate">{c.name}</span>
                              </span>
                              <span className="font-mono-tabular text-[11px] text-slate-400">
                                {c.code}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#F5C451] px-4 py-3 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472] active:scale-[0.98] disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              <span>{submitting ? 'Encrypting & Creating...' : 'Create Encrypted Profile'}</span>
            </button>
          </form>
        )}

        {/* LOGIN FORM */}
        {tab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="mt-4 space-y-3.5" noValidate>
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-300">
                Gmail / Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                placeholder="player@gmail.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-xl border border-white/15 bg-black/35 px-3 text-sm text-white placeholder:text-slate-500 focus:border-[#F5C451] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="login-password"
                  type={loginShowPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-white/15 bg-black/35 pr-11 pl-3 text-sm text-white placeholder:text-slate-500 focus:border-[#F5C451] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setLoginShowPassword((s) => !s)}
                  aria-label={loginShowPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-white"
                >
                  {loginShowPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#F5C451] px-4 py-3 text-sm font-bold text-[#051610] transition hover:bg-[#fbd472] active:scale-[0.98] disabled:opacity-60"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              <span>{submitting ? 'Verifying Hash...' : 'Login to ArenaX'}</span>
            </button>
          </form>
        )}

        {/* Secondary Quick Guest Play + Privacy Footer */}
        <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={handleGuestPlay}
            className="min-h-[44px] w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-xs font-semibold text-slate-100 transition hover:bg-white/12 active:scale-[0.98] sm:text-sm"
          >
            Quick Guest Play (No Account Needed)
          </button>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Local SHA-256 Salted Auth</span>
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="font-semibold text-emerald-300 hover:underline underline-offset-4"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
