import { CountryOption } from '../data/countries';
import { calculateMatchPoints, MatchPointsBreakdown } from './rankings';

export type GenderOption = 'Male' | 'Female' | 'Other' | 'Prefer not to say';

export interface StoredUserRecord {
  id: string;
  email: string;
  username: string;
  gender: GenderOption;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  salt: string;
  passwordHash: string;
  arcadeWins: number;
  arenaPoints?: number;
  cricketWins?: number;
  carromWins?: number;
  carromQueenCaptures?: number;
  penaltyWins?: number;
  chessWins?: number;
  dailyWinStreak?: number;
  lastWinDate?: string | null;
  disabled?: boolean;
  createdAt: number;
}

export interface ActivePlayerProfile {
  id: string;
  email: string;
  username: string;
  gender: GenderOption;
  countryCode: string;
  countryName: string;
  countryFlag: string;
  arcadeWins: number;
  arenaPoints: number;
  cricketWins: number;
  carromWins: number;
  carromQueenCaptures: number;
  penaltyWins: number;
  chessWins: number;
  dailyWinStreak: number;
  lastWinDate: string | null;
  isGuest: boolean;
}

const USERS_KEY = 'arenax_users_v1';
const SESSION_KEY = 'arenax_session_v1';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/**
 * Client-side SHA-256 hashing with a per-user random salt via native Web Crypto API.
 * Plain-text passwords are never stored anywhere.
 */
async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getYesterdayDateKey(): string {
  const dt = new Date();
  dt.setDate(dt.getDate() - 1);
  return getLocalDateKey(dt);
}

function computeNextDailyStreak(
  currentStreak: number | undefined,
  lastWinDate: string | null | undefined
): { dailyWinStreak: number; lastWinDate: string } {
  const today = getLocalDateKey();
  const yesterday = getYesterdayDateKey();
  const streak = currentStreak || 0;

  if (lastWinDate === today) {
    return { dailyWinStreak: Math.max(1, streak), lastWinDate: today };
  }
  if (lastWinDate === yesterday) {
    return { dailyWinStreak: streak + 1, lastWinDate: today };
  }
  return { dailyWinStreak: 1, lastWinDate: today };
}

function loadUsers(): StoredUserRecord[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredUserRecord[]) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUserRecord[]): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    // Ignore quota errors
  }
}

function resolveArenaPoints(record: {
  arenaPoints?: number;
  arcadeWins?: number;
  carromQueenCaptures?: number;
}): number {
  if (typeof record.arenaPoints === 'number' && Number.isFinite(record.arenaPoints)) {
    return Math.max(0, Math.floor(record.arenaPoints));
  }
  const wins = record.arcadeWins || 0;
  const queens = record.carromQueenCaptures || 0;
  return wins * 115 + queens * 25;
}

function toPublicProfile(record: StoredUserRecord): ActivePlayerProfile {
  return {
    id: record.id,
    email: record.email,
    username: record.username,
    gender: record.gender,
    countryCode: record.countryCode,
    countryName: record.countryName,
    countryFlag: record.countryFlag,
    arcadeWins: record.arcadeWins || 0,
    arenaPoints: resolveArenaPoints(record),
    cricketWins: record.cricketWins || 0,
    carromWins: record.carromWins || 0,
    carromQueenCaptures: record.carromQueenCaptures || 0,
    penaltyWins: record.penaltyWins || 0,
    chessWins: record.chessWins || 0,
    dailyWinStreak: record.dailyWinStreak || 0,
    lastWinDate: record.lastWinDate || null,
    isGuest: false,
  };
}

export function getActiveSession(): ActivePlayerProfile | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as {
      userId?: string;
      isGuest?: boolean;
      guestWins?: number;
      guestArenaPoints?: number;
      guestCricketWins?: number;
      guestCarromWins?: number;
      guestQueenCaptures?: number;
      guestPenaltyWins?: number;
      guestChessWins?: number;
      guestDailyWinStreak?: number;
      guestLastWinDate?: string | null;
    };
    if (session.isGuest) {
      const gWins = Number(session.guestWins) || 0;
      const gQueens = Number(session.guestQueenCaptures) || 0;
      const gPoints =
        typeof session.guestArenaPoints === 'number'
          ? Math.max(0, Math.floor(session.guestArenaPoints))
          : gWins * 115 + gQueens * 25;
      return {
        id: 'guest',
        email: '',
        username: 'Guest Pro',
        gender: 'Prefer not to say',
        countryCode: 'IN',
        countryName: 'India',
        countryFlag: '🇮🇳',
        arcadeWins: gWins,
        arenaPoints: gPoints,
        cricketWins: Number(session.guestCricketWins) || 0,
        carromWins: Number(session.guestCarromWins) || 0,
        carromQueenCaptures: gQueens,
        penaltyWins: Number(session.guestPenaltyWins) || 0,
        chessWins: Number(session.guestChessWins) || 0,
        dailyWinStreak: Number(session.guestDailyWinStreak) || 0,
        lastWinDate: session.guestLastWinDate || null,
        isGuest: true,
      };
    }
    if (!session.userId) return null;
    const users = loadUsers();
    const found = users.find((u) => u.id === session.userId && !u.disabled);
    return found ? toPublicProfile(found) : null;
  } catch {
    return null;
  }
}

export async function registerUser(params: {
  email: string;
  username: string;
  password: string;
  gender: GenderOption;
  country: CountryOption;
}): Promise<{ ok: true; profile: ActivePlayerProfile } | { ok: false; error: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanUsername = params.username.trim();

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: 'Please enter a valid Gmail or email address.' };
  }
  if (cleanUsername.length < 2 || cleanUsername.length > 18) {
    return { ok: false, error: 'Username must be between 2 and 18 characters.' };
  }
  if (params.password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters long.' };
  }

  const users = loadUsers();
  if (users.some((u) => u.email === cleanEmail)) {
    return { ok: false, error: 'An account with this email already exists on this device.' };
  }

  const salt = generateSalt();
  const passwordHash = await hashPasswordWithSalt(params.password, salt);

  const newUser: StoredUserRecord = {
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    email: cleanEmail,
    username: cleanUsername,
    gender: params.gender,
    countryCode: params.country.code,
    countryName: params.country.name,
    countryFlag: params.country.flag,
    salt,
    passwordHash,
    arcadeWins: 0,
    arenaPoints: 0,
    cricketWins: 0,
    carromWins: 0,
    carromQueenCaptures: 0,
    penaltyWins: 0,
    chessWins: 0,
    dailyWinStreak: 0,
    lastWinDate: null,
    disabled: false,
    createdAt: Date.now(),
  };

  saveUsers([...users, newUser]);
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: newUser.id, isGuest: false }));
  } catch {
    // Ignore storage error
  }

  return { ok: true, profile: toPublicProfile(newUser) };
}

export async function loginUser(params: {
  email: string;
  password: string;
}): Promise<
  | { ok: true; profile: ActivePlayerProfile }
  | { ok: false; error: string; deactivated?: boolean }
> {
  const cleanEmail = params.email.trim().toLowerCase();
  if (!cleanEmail || !params.password) {
    return { ok: false, error: 'Please enter both your email and password.' };
  }

  const users = loadUsers();
  const user = users.find((u) => u.email === cleanEmail);
  if (!user) {
    return { ok: false, error: 'No local account found for that email on this device.' };
  }

  const computedHash = await hashPasswordWithSalt(params.password, user.salt);
  if (computedHash !== user.passwordHash) {
    return { ok: false, error: 'Incorrect password. Please try again.' };
  }

  if (user.disabled) {
    return {
      ok: false,
      deactivated: true,
      error: 'This account is currently deactivated. Reactivate it below to sign back in.',
    };
  }

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, isGuest: false }));
  } catch {
    // Ignore storage error
  }

  return { ok: true, profile: toPublicProfile(user) };
}

export async function reactivateUserAccount(params: {
  email: string;
  password: string;
}): Promise<{ ok: true; profile: ActivePlayerProfile } | { ok: false; error: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const users = loadUsers();
  const user = users.find((u) => u.email === cleanEmail);
  if (!user) {
    return { ok: false, error: 'No local account found for that email.' };
  }

  const computedHash = await hashPasswordWithSalt(params.password, user.salt);
  if (computedHash !== user.passwordHash) {
    return { ok: false, error: 'Password verification failed.' };
  }

  const updatedUsers = users.map((u) =>
    u.id === user.id ? { ...u, disabled: false } : u
  );
  saveUsers(updatedUsers);
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, isGuest: false }));
  } catch {
    // Ignore
  }

  const reactivated = updatedUsers.find((u) => u.id === user.id)!;
  return { ok: true, profile: toPublicProfile(reactivated) };
}

export async function changeUserPassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!params.currentPassword || !params.newPassword) {
    return { ok: false, error: 'Please enter both your current and new password.' };
  }
  if (params.newPassword.length < 6) {
    return { ok: false, error: 'New password must be at least 6 characters long.' };
  }
  if (params.currentPassword === params.newPassword) {
    return { ok: false, error: 'New password must be different from your current password.' };
  }

  const users = loadUsers();
  const user = users.find((u) => u.id === params.userId);
  if (!user) {
    return { ok: false, error: 'Account record not found on this device.' };
  }

  const currentHash = await hashPasswordWithSalt(params.currentPassword, user.salt);
  if (currentHash !== user.passwordHash) {
    return { ok: false, error: 'Current password is incorrect.' };
  }

  const newSalt = generateSalt();
  const newHash = await hashPasswordWithSalt(params.newPassword, newSalt);
  const updatedUsers = users.map((u) =>
    u.id === user.id ? { ...u, salt: newSalt, passwordHash: newHash } : u
  );
  saveUsers(updatedUsers);
  return { ok: true };
}

export function deactivateUserAccount(userId: string): void {
  const users = loadUsers();
  const updatedUsers = users.map((u) =>
    u.id === userId ? { ...u, disabled: true } : u
  );
  saveUsers(updatedUsers);
  logoutSession();
}

export function deleteUserAccount(userId: string): void {
  const users = loadUsers();
  const remaining = users.filter((u) => u.id !== userId);
  saveUsers(remaining);
  logoutSession();
}

export function startGuestSession(): ActivePlayerProfile {
  const guest: ActivePlayerProfile = {
    id: 'guest',
    email: '',
    username: 'Guest Pro',
    gender: 'Prefer not to say',
    countryCode: 'IN',
    countryName: 'India',
    countryFlag: '🇮🇳',
    arcadeWins: 0,
    arenaPoints: 0,
    cricketWins: 0,
    carromWins: 0,
    carromQueenCaptures: 0,
    penaltyWins: 0,
    chessWins: 0,
    dailyWinStreak: 0,
    lastWinDate: null,
    isGuest: true,
  };
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        isGuest: true,
        guestWins: 0,
        guestArenaPoints: 0,
        guestCricketWins: 0,
        guestCarromWins: 0,
        guestQueenCaptures: 0,
        guestPenaltyWins: 0,
        guestChessWins: 0,
        guestDailyWinStreak: 0,
        guestLastWinDate: null,
      })
    );
  } catch {
    // Ignore
  }
  return guest;
}

export function logoutSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore
  }
}

function saveGuestSnapshot(p: ActivePlayerProfile): void {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        isGuest: true,
        guestWins: p.arcadeWins,
        guestArenaPoints: p.arenaPoints,
        guestCricketWins: p.cricketWins,
        guestCarromWins: p.carromWins,
        guestQueenCaptures: p.carromQueenCaptures,
        guestPenaltyWins: p.penaltyWins,
        guestChessWins: p.chessWins,
        guestDailyWinStreak: p.dailyWinStreak,
        guestLastWinDate: p.lastWinDate,
      })
    );
  } catch {
    // Ignore
  }
}

export function recordMatchResult(
  profile: ActivePlayerProfile,
  params: {
    sport: 'cricket' | 'carrom' | 'penalty' | 'chess';
    outcome: 'win' | 'draw' | 'loss';
    bonusCount?: number;
    bonusLabel?: string;
  }
): { profile: ActivePlayerProfile; breakdown: MatchPointsBreakdown } {
  const breakdown = calculateMatchPoints({
    outcome: params.outcome,
    bonusCount: params.bonusCount,
    bonusLabel: params.bonusLabel,
  });

  const isWin = params.outcome === 'win';
  const addWin = isWin ? 1 : 0;
  const streakInfo = isWin
    ? computeNextDailyStreak(profile.dailyWinStreak, profile.lastWinDate)
    : { dailyWinStreak: profile.dailyWinStreak, lastWinDate: profile.lastWinDate };

  const next: ActivePlayerProfile = {
    ...profile,
    arcadeWins: profile.arcadeWins + addWin,
    arenaPoints: profile.arenaPoints + breakdown.totalEarned,
    cricketWins: profile.cricketWins + (isWin && params.sport === 'cricket' ? 1 : 0),
    carromWins: profile.carromWins + (isWin && params.sport === 'carrom' ? 1 : 0),
    penaltyWins: profile.penaltyWins + (isWin && params.sport === 'penalty' ? 1 : 0),
    chessWins: profile.chessWins + (isWin && params.sport === 'chess' ? 1 : 0),
    dailyWinStreak: streakInfo.dailyWinStreak,
    lastWinDate: streakInfo.lastWinDate,
  };

  if (profile.isGuest) {
    saveGuestSnapshot(next);
    return { profile: next, breakdown };
  }

  const users = loadUsers();
  const updatedUsers = users.map((u) => {
    if (u.id !== profile.id) return u;
    const s = isWin
      ? computeNextDailyStreak(u.dailyWinStreak, u.lastWinDate)
      : { dailyWinStreak: u.dailyWinStreak || 0, lastWinDate: u.lastWinDate || null };
    return {
      ...u,
      arcadeWins: (u.arcadeWins || 0) + addWin,
      arenaPoints: resolveArenaPoints(u) + breakdown.totalEarned,
      cricketWins: (u.cricketWins || 0) + (isWin && params.sport === 'cricket' ? 1 : 0),
      carromWins: (u.carromWins || 0) + (isWin && params.sport === 'carrom' ? 1 : 0),
      penaltyWins: (u.penaltyWins || 0) + (isWin && params.sport === 'penalty' ? 1 : 0),
      chessWins: (u.chessWins || 0) + (isWin && params.sport === 'chess' ? 1 : 0),
      dailyWinStreak: s.dailyWinStreak,
      lastWinDate: s.lastWinDate,
    };
  });
  saveUsers(updatedUsers);
  const updated = updatedUsers.find((u) => u.id === profile.id);
  return {
    profile: updated ? toPublicProfile(updated) : next,
    breakdown,
  };
}

export function recordCarromQueenCapture(profile: ActivePlayerProfile): ActivePlayerProfile {
  const next: ActivePlayerProfile = {
    ...profile,
    carromQueenCaptures: profile.carromQueenCaptures + 1,
  };

  if (profile.isGuest) {
    saveGuestSnapshot(next);
    return next;
  }

  const users = loadUsers();
  const updatedUsers = users.map((u) =>
    u.id === profile.id
      ? {
          ...u,
          carromQueenCaptures: (u.carromQueenCaptures || 0) + 1,
        }
      : u
  );
  saveUsers(updatedUsers);
  const updated = updatedUsers.find((u) => u.id === profile.id);
  return updated ? toPublicProfile(updated) : next;
}

export function resetUserGameStats(profile: ActivePlayerProfile): ActivePlayerProfile {
  const zeroed: ActivePlayerProfile = {
    ...profile,
    arcadeWins: 0,
    arenaPoints: 0,
    cricketWins: 0,
    carromWins: 0,
    carromQueenCaptures: 0,
    penaltyWins: 0,
    chessWins: 0,
    dailyWinStreak: 0,
    lastWinDate: null,
  };

  if (profile.isGuest) {
    saveGuestSnapshot(zeroed);
    return zeroed;
  }

  const users = loadUsers();
  const updatedUsers = users.map((u) =>
    u.id === profile.id
      ? {
          ...u,
          arcadeWins: 0,
          arenaPoints: 0,
          cricketWins: 0,
          carromWins: 0,
          carromQueenCaptures: 0,
          penaltyWins: 0,
          chessWins: 0,
          dailyWinStreak: 0,
          lastWinDate: null,
        }
      : u
  );
  saveUsers(updatedUsers);
  const updated = updatedUsers.find((u) => u.id === profile.id);
  return updated ? toPublicProfile(updated) : zeroed;
}

export interface DeviceLeaderboardEntry {
  id: string;
  username: string;
  countryFlag: string;
  countryName: string;
  arenaPoints: number;
  arcadeWins: number;
  dailyWinStreak: number;
  isGuest: boolean;
  isCurrentUser: boolean;
}

export function getDeviceLeaderboard(
  activeProfile: ActivePlayerProfile | null
): DeviceLeaderboardEntry[] {
  const registered = loadUsers()
    .filter((u) => !u.disabled)
    .map<DeviceLeaderboardEntry>((u) => ({
      id: u.id,
      username: u.username,
      countryFlag: u.countryFlag,
      countryName: u.countryName,
      arenaPoints: resolveArenaPoints(u),
      arcadeWins: u.arcadeWins || 0,
      dailyWinStreak: u.dailyWinStreak || 0,
      isGuest: false,
      isCurrentUser: Boolean(activeProfile && !activeProfile.isGuest && activeProfile.id === u.id),
    }));

  if (activeProfile?.isGuest) {
    registered.push({
      id: 'guest',
      username: activeProfile.username,
      countryFlag: activeProfile.countryFlag,
      countryName: activeProfile.countryName,
      arenaPoints: activeProfile.arenaPoints,
      arcadeWins: activeProfile.arcadeWins,
      dailyWinStreak: activeProfile.dailyWinStreak,
      isGuest: true,
      isCurrentUser: true,
    });
  }

  return registered.sort((a, b) => {
    if (b.arenaPoints !== a.arenaPoints) return b.arenaPoints - a.arenaPoints;
    if (b.arcadeWins !== a.arcadeWins) return b.arcadeWins - a.arcadeWins;
    if (b.dailyWinStreak !== a.dailyWinStreak) return b.dailyWinStreak - a.dailyWinStreak;
    return a.username.localeCompare(b.username);
  });
}
