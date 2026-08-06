import { ArrowLeft, CheckCircle2, Loader2, MonitorPlay } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { User } from "./types";

type Mode = "login" | "register";

export function AuthScreen({
  onAuth,
  onCancel,
}: {
  onAuth: (user: User) => void;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as { user?: User; error?: string; ok?: boolean };
      if (!response.ok) {
        setError(data.error ?? "Có lỗi xảy ra.");
        return;
      }
      if (mode === "register") {
        setSuccess("Đăng ký thành công! Mời bạn đăng nhập.");
        setMode("login");
        setPassword("");
        return;
      }
      if (data.user) onAuth(data.user);
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-zinc-100">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="mb-1 inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-sm text-zinc-400 transition hover:text-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </button>
          )}
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <MonitorPlay className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Video Player</h1>
            <p className="text-sm text-zinc-400">Đăng nhập để tiếp tục xem video</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-xl">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-white/5 p-1">
            {(["login", "register"] as const).map(item => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item);
                  setError(null);
                  setSuccess(null);
                }}
                className={cn(
                  "rounded-md py-2 text-sm font-medium transition",
                  mode === item ? "bg-emerald-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                {item === "login" ? "Đăng nhập" : "Đăng ký"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={event => setUsername(event.target.value)}
                placeholder="3–32 ký tự chữ, số hoặc _"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Ít nhất 6 ký tự"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

            {success && (
              <p className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                {success}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="h-10 w-full bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "login" ? (
                "Đăng nhập"
              ) : (
                "Đăng ký"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
