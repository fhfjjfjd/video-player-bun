import { Loader2, MessageSquare, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FeedbackItem, FeedbackType } from "./types";

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
}

const TYPE_LABELS: Record<FeedbackType, string> = {
  feature: "Tính năng mới",
  bug: "Sửa lỗi",
  other: "Khác",
};

const TYPE_BADGE: Record<FeedbackType, string> = {
  feature: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  bug: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  other: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Renders `**bold**` markers so replies read cleanly instead of showing raw syntax. */
function InlineMarkdown({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
        part.length > 4 && part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

export function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<FeedbackType>("feature");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    fetch("/api/feedback")
      .then(res => (res.ok ? res.json() : Promise.reject(new Error("Không tải được danh sách."))))
      .then((data: { feedback?: FeedbackItem[] }) => setItems(data.feedback ?? []))
      .catch(err => setError(err instanceof Error ? err.message : "Lỗi tải danh sách."))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, title, body }),
    })
      .then(async res => {
        const data = (await res.json()) as { feedback?: FeedbackItem; error?: string };
        if (!res.ok || !data.feedback) throw new Error(data.error ?? "Gửi góp ý thất bại.");
        setItems(prev => [data.feedback!, ...prev]);
        setType("feature");
        setTitle("");
        setBody("");
        setSuccess("Đã gửi góp ý. Cảm ơn bạn!");
      })
      .catch(err => setError(err instanceof Error ? err.message : "Gửi góp ý thất bại."))
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Góp ý"
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 text-zinc-100 shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare className="h-5 w-5 text-emerald-400" />
            Góp ý
          </h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Đóng" className="h-8 w-8 text-white hover:bg-white/10">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          {error && <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>}
          {success && <p className="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{success}</p>}

          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-400" htmlFor="feedback-type">
                Loại góp ý
              </label>
              <Select value={type} onValueChange={value => setType(value as FeedbackType)}>
                <SelectTrigger id="feedback-type" aria-label="Loại góp ý" className="h-9 border-white/15 bg-white/5 text-white hover:bg-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-zinc-100">
                  {(Object.keys(TYPE_LABELS) as FeedbackType[]).map(value => (
                    <SelectItem key={value} value={value}>
                      {TYPE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-400" htmlFor="feedback-title">
                Tiêu đề
              </label>
              <input
                id="feedback-title"
                type="text"
                value={title}
                onChange={event => setTitle(event.target.value)}
                maxLength={100}
                required
                placeholder="Mô tả ngắn gọn"
                className="h-9 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-400" htmlFor="feedback-body">
                Nội dung chi tiết
              </label>
              <textarea
                id="feedback-body"
                value={body}
                onChange={event => setBody(event.target.value)}
                maxLength={2000}
                required
                rows={3}
                placeholder="Mô tả tính năng bạn muốn, lỗi gặp phải, hoặc ý tưởng khác…"
                className="min-h-20 w-full resize-none rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>

            <Button type="submit" disabled={submitting} className="h-10 gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi góp ý
            </Button>
          </form>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Danh sách góp ý</h3>
            {loading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải…
              </div>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">Chưa có góp ý nào.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map(item => (
                  <li key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${TYPE_BADGE[item.type]}`}>
                        {TYPE_LABELS[item.type]}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          item.status === "open"
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
                        }`}
                      >
                        {item.status === "open" ? "Mở" : "Đóng"}
                      </span>
                      <span className="ml-auto text-[11px] tabular-nums text-zinc-500">{formatDate(item.created_at)}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium leading-snug">{item.title}</p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{item.body}</p>
                    {item.reply && (
                      <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">Phản hồi</p>
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">
                          <InlineMarkdown text={item.reply} />
                        </p>
                      </div>
                    )}
                    {item.author && <p className="mt-1 text-[11px] text-zinc-500">Bởi {item.author}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
