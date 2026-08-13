import { ArrowLeft, BadgeCheck, CheckCircle2, Clapperboard, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "./BrandLogo";
import { cn } from "@/lib/utils";
import type { User } from "./types";
import { loginSchema, registerSchema, validateForm, type FieldErrors } from "@/lib/validation";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const clearFieldError = (field: string) =>
    setFieldErrors(prev => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const schema = mode === "register" ? registerSchema : loginSchema;
    const data = mode === "register" ? { username, email, password } : { username, password };
    const errors = validateForm(schema, data);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const res = (await response.json()) as { user?: User; error?: string; ok?: boolean };
      if (!response.ok) {
        setError(res.error ?? "Có lỗi xảy ra.");
        return;
      }
      if (mode === "register") {
        setVerifyingEmail(email);
        setOtpCode("");
        setError(null);
        setSuccess(null);
        setUsername("");
        setEmail("");
        setPassword("");
        return;
      }
      if (res.user) onAuth(res.user);
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setSubmitting(false);
    }
  };

  const onVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!verifyingEmail) return;
    const code = otpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError("Mã xác thực phải gồm 6 chữ số.");
      return;
    }
    setError(null);
    setSuccess(null);
    setVerifying(true);
    try {
      const response = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifyingEmail, code }),
      });
      const res = (await response.json()) as { user?: User; error?: string };
      if (!response.ok) {
        setError(res.error ?? "Xác thực thất bại.");
        return;
      }
      if (res.user) onAuth(res.user);
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    if (!verifyingEmail || resending) return;
    setError(null);
    setSuccess(null);
    setResending(true);
    try {
      const response = await fetch("/api/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifyingEmail }),
      });
      const res = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setError(res.error ?? "Không thể gửi lại mã.");
      } else {
        setSuccess("Đã gửi lại mã xác thực. Kiểm tra email của bạn.");
      }
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 p-4 text-zinc-100">
      <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl lg:grid-cols-2">
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-500/15 via-transparent to-cyan-500/15 p-8 lg:flex">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-12 w-12" />
            <div>
              <div className="text-lg font-bold tracking-tight">
                Video<span className="text-brand-gradient">Player</span>
              </div>
              <p className="text-xs text-zinc-400">Trải nghiệm xem video mượt mà</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-zinc-300">
            <Clapperboard className="h-5 w-5 text-emerald-400" />
            <span>Xem, tải lên và quản lý video mọi lúc mọi nơi.</span>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <div className="mb-6 flex items-center justify-between">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-zinc-400 transition hover:text-zinc-100"
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại
              </button>
            )}
            <BrandLogo className="h-10 w-10 lg:hidden" />
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">
              {verifyingEmail ? "Xác thực email" : mode === "login" ? "Chào mừng trở lại" : "Tạo tài khoản"}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {verifyingEmail
                ? "Nhập mã 6 chữ số chúng tôi vừa gửi để hoàn tất đăng ký"
                : mode === "login"
                  ? "Đăng nhập để tiếp tục xem video"
                  : "Đăng ký để bắt đầu trải nghiệm"}
            </p>
          </div>

          {verifyingEmail && (
            <form onSubmit={onVerify} className="mb-6 flex flex-col gap-4">
              <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Đã gửi mã xác thực tới <span className="font-medium">{verifyingEmail}</span>. Kiểm tra hộp thư
                  (kể cả thư rác).
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="otp">Mã xác thực (6 chữ số)</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={event => {
                    setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                    setError(null);
                  }}
                  placeholder="VD: 123456"
                  className="h-11 rounded-xl border-white/10 bg-white/5 text-center font-mono text-lg tracking-[0.5em] text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400/60"
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
                disabled={verifying || resending}
                variant="brand"
                className="mt-1 h-11 w-full rounded-xl"
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xác nhận & hoàn tất đăng ký"}
              </Button>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={resending}
                  onClick={onResend}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-zinc-400 transition hover:text-zinc-100 disabled:opacity-50"
                >
                  {resending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Gửi lại mã
                </button>
                <button
                  type="button"
                  disabled={verifying}
                  onClick={() => {
                    setVerifyingEmail(null);
                    setOtpCode("");
                    setError(null);
                    setSuccess(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-zinc-400 transition hover:text-zinc-100 disabled:opacity-50"
                >
                  Đăng ký lại với email khác
                </button>
              </div>
            </form>
          )}

          {!verifyingEmail && (
            <>
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/5 p-1">
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
                  "rounded-full py-2 text-sm font-medium transition-all",
                  mode === item
                    ? "bg-brand-gradient text-zinc-950 shadow-brand"
                    : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                {item === "login" ? "Đăng nhập" : "Đăng ký"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">{mode === "login" ? "Gmail hoặc Username" : "Username"}</Label>
              <Input
                id="username"
                value={username}
                onChange={event => {
                  setUsername(event.target.value);
                  clearFieldError("username");
                }}
                placeholder={mode === "login" ? "Tên người dùng hoặc …@gmail.com" : "3–32 ký tự chữ, số hoặc _"}
                autoComplete="username"
                autoFocus
                className="h-11 rounded-xl border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400/60"
              />
              {fieldErrors.username && <p className="text-xs text-red-400">{fieldErrors.username}</p>}
            </div>
            {mode === "register" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email (Gmail)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={event => {
                    setEmail(event.target.value);
                    clearFieldError("email");
                  }}
                  placeholder="Bắt buộc dùng Gmail (…@gmail.com)"
                  autoComplete="email"
                  required
                  className="h-11 rounded-xl border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400/60"
                />
                {fieldErrors.email && <p className="text-xs text-red-400">{fieldErrors.email}</p>}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={event => {
                  setPassword(event.target.value);
                  clearFieldError("password");
                }}
                placeholder="Ít nhất 6 ký tự"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="h-11 rounded-xl border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400/60"
              />
              {fieldErrors.password && <p className="text-xs text-red-400">{fieldErrors.password}</p>}
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
              variant="brand"
              className="mt-1 h-11 w-full rounded-xl"
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
