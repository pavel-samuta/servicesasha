import { FormEvent, useState } from 'react';
import { Cloud, HardDrive, KeyRound, LogIn, LogOut, ShieldCheck, User, UserPlus, X } from 'lucide-react';
import {
  loginCloudPlayer,
  loginWithGooglePopup,
  PlayerAccountSession,
  ProviderDisabledError,
  registerCloudPlayer,
  registerOrLoginLocalPlayer,
} from '../game/playerStorage';

interface PlayerAccountModalProps {
  session: PlayerAccountSession | null;
  onClose: () => void;
  onAuthenticated: (session: PlayerAccountSession) => void;
  onLogout: () => Promise<void>;
}

type AuthTab = 'login' | 'register';

export function PlayerAccountModal({
  session,
  onClose,
  onAuthenticated,
  onLogout,
}: PlayerAccountModalProps) {
  const [tab, setTab] = useState<AuthTab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showLocalFallbackOffer, setShowLocalFallbackOffer] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setShowLocalFallbackOffer(false);
    setLoading(true);
    try {
      const nextSession =
        tab === 'register'
          ? await registerCloudPlayer(username, password)
          : await loginCloudPlayer(username, password);
      onAuthenticated(nextSession);
      onClose();
    } catch (err) {
      if (err instanceof ProviderDisabledError) {
        setShowLocalFallbackOffer(true);
      }
      setErrorMsg(err instanceof Error ? err.message : 'Не удалось выполнить вход.');
    } finally {
      setLoading(false);
    }
  };

  const handleLocalFallback = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const nextSession = await registerOrLoginLocalPlayer(username, password, tab);
      onAuthenticated(nextSession);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Не удалось открыть локальный профиль.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setShowLocalFallbackOffer(false);
    setLoading(true);
    try {
      const nextSession = await loginWithGooglePopup();
      onAuthenticated(nextSession);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Не удалось войти через Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    setLoading(true);
    try {
      await onLogout();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#040911]/88 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200/15 bg-[#0A1420] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/10 pb-4">
          <div>
            <p className="text-xs font-medium text-amber-300">Память игрока</p>
            <h2 className="font-display text-2xl font-bold text-slate-50">
              {session ? 'Профиль капитана' : 'Вход и сохранение'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно профиля"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200/10 bg-slate-800/70 text-slate-300 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {session ? (
          <div className="space-y-5 pt-5">
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <User className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="truncate text-base font-bold text-slate-50">{session.username}</div>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-300">
                      {session.kind === 'cloud' ? (
                        <>
                          <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Облачное сохранение Firebase</span>
                        </>
                      ) : (
                        <>
                          <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Локальный профиль браузера</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200/10 pt-3 text-xs">
                <div>
                  <span className="text-slate-400">Лучший счёт:</span>
                  <div className="font-mono-nums text-sm font-bold text-amber-300">
                    {session.records.highScore.toLocaleString('ru-RU')}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Макс. тур:</span>
                  <div className="font-mono-nums text-sm font-bold text-slate-100">
                    {session.records.bestWave}/20
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleLogoutClick}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/35 bg-red-950/30 px-4 py-2.5 text-sm font-semibold text-red-200 transition-colors hover:bg-red-900/40 disabled:opacity-50 whitespace-nowrap"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Выйти и сменить игрока</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200/10 bg-slate-800/70 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 whitespace-nowrap"
              >
                Вернуться на причал
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            <p className="text-xs leading-relaxed text-slate-300">
              Создайте имя и пароль для каждого игрока — рекорды, бестиарий, достижения и текущий тур
              будут сохраняться отдельно для каждого капитана.
            </p>

            {/* Login / Register Tab Switch */}
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200/10 bg-[#060C12] p-1">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMsg(null);
                  setShowLocalFallbackOffer(false);
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  tab === 'login'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Войти</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMsg(null);
                  setShowLocalFallbackOffer(false);
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  tab === 'register'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Новый игрок</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="player-username" className="block text-xs font-semibold text-slate-200">
                  Имя игрока
                </label>
                <div className="relative mt-1">
                  <User
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="player-username"
                    type="text"
                    required
                    minLength={2}
                    maxLength={32}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Например: Барон Саша"
                    autoComplete="username"
                    className="w-full rounded-lg border border-slate-200/15 bg-[#060C12] py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="player-password" className="block text-xs font-semibold text-slate-200">
                  Пароль (минимум 6 символов)
                </label>
                <div className="relative mt-1">
                  <KeyRound
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="player-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    maxLength={64}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                    className="w-full rounded-lg border border-slate-200/15 bg-[#060C12] py-2.5 pl-9 pr-20 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400 hover:text-amber-300"
                  >
                    {showPassword ? 'Скрыть' : 'Показать'}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="space-y-2 rounded-lg border border-red-500/35 bg-red-950/30 p-3 text-xs leading-relaxed text-red-200">
                  <p>{errorMsg}</p>
                  {showLocalFallbackOffer && (
                    <button
                      type="button"
                      onClick={handleLocalFallback}
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-amber-400/45 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-500 hover:text-slate-950 whitespace-nowrap"
                    >
                      <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {tab === 'register'
                          ? 'Создать локальный профиль с этим паролем'
                          : 'Войти в локальный профиль с этим паролем'}
                      </span>
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-50 whitespace-nowrap"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>
                  {loading
                    ? 'Подключение...'
                    : tab === 'register'
                      ? 'Создать профиль в облаке'
                      : 'Войти в профиль'}
                </span>
              </button>
            </form>

            <div className="relative flex items-center py-1">
              <div className="flex-1 border-t border-slate-200/10" />
              <span className="px-3 text-[11px] text-slate-500">или</span>
              <div className="flex-1 border-t border-slate-200/10" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200/15 bg-[#0F1C2B] px-4 py-2.5 text-xs font-semibold text-slate-100 transition-colors hover:border-amber-400/40 hover:bg-[#132437] disabled:opacity-50 whitespace-nowrap"
            >
              <Cloud className="h-4 w-4 text-sky-300" aria-hidden="true" />
              <span>Войти через Google (мгновенно в облако)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
