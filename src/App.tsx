import { Loader2, RefreshCw, ServerCrash } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthScreen } from "./AuthScreen";
import { ErrorBoundary } from "./ErrorBoundary";
import { HomePage } from "./HomePage";
import { VideoPage } from "./VideoPage";
import type { User } from "./types";
import "./index.css";

type AuthStatus = "loading" | "guest" | "authed" | "offline";

function getVideoIdFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/video\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="relative flex flex-col items-center gap-4">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-brand-gradient-soft blur-2xl" />
        <Loader2 className="h-9 w-9 animate-spin text-emerald-400" />
        <span className="text-sm font-medium tracking-tight text-zinc-400">Video Player</span>
      </div>
    </div>
  );
}

function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-zinc-950 p-4 text-center text-zinc-100">
      <div className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-red-500/10 blur-3xl" />
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-red-500/20 bg-red-500/10 text-red-400">
        <ServerCrash className="h-10 w-10" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Không thể kết nối máy chủ</h1>
        <p className="mt-1 max-w-xs text-sm text-zinc-400">
          Không nhận được phản hồi từ máy chủ. Vui lòng kiểm tra server API rồi thử lại.
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-brand transition hover:brightness-110"
      >
        <RefreshCw className="h-4 w-4" />
        Thử lại
      </button>
    </div>
  );
}

export function App() {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then(async response => {
        if (cancelled) return;
        if (response.status === 401) {
          setStatus("guest");
          return;
        }
        if (!response.ok) {
          setStatus("offline");
          return;
        }
        const data = (await response.json()) as { user: User };
        setUser(data.user);
        setStatus("authed");
      })
      .catch(() => {
        if (!cancelled) setStatus("offline");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((path: string) => {
    history.pushState(null, "", path);
    setPathname(path);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    navigate("/");
    setUser(null);
    setStatus("guest");
  };

  const handleAuth = (authedUser: User) => {
    setUser(authedUser);
    setStatus("authed");
    setAuthOpen(false);
  };

  const videoId = useMemo(() => getVideoIdFromPath(pathname), [pathname]);

  if (status === "loading") return <Splash />;
  if (status === "offline") return <OfflineScreen onRetry={() => setReloadKey(k => k + 1)} />;

  const common = {
    user: user?.username ?? null,
    onLogout: handleLogout,
    onLogin: () => setAuthOpen(true),
    search,
    onOpenVideo: (id: number) => navigate(`/video/${id}`),
  };

  return (
    <ErrorBoundary>
      {authOpen ? (
        <AuthScreen onAuth={handleAuth} onCancel={() => setAuthOpen(false)} />
      ) : videoId !== null ? (
        <VideoPage {...common} videoId={videoId} onBack={() => navigate("/")} />
      ) : (
        <HomePage {...common} onSearchChange={setSearch} />
      )}
    </ErrorBoundary>
  );
}

export default App;
