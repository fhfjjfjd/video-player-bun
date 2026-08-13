import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderActionsProps {
  user: string | null;
  onLogout: () => void;
  onLogin: () => void;
}

function initials(name: string): string {
  return name
    .split(/[\s_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("");
}

export function HeaderActions({ user, onLogout, onLogin }: HeaderActionsProps) {
  if (user) {
    return (
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pr-3 pl-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-bold text-zinc-950">
            {initials(user)}
          </span>
          <span className="hidden max-w-[120px] truncate text-sm font-medium text-zinc-200 sm:inline">
            {user}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onLogout}
          aria-label="Đăng xuất"
          className="h-9 w-9 text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4.5 w-4.5" />
        </Button>
      </div>
    );
  }
  return (
    <Button type="button" variant="brand" size="sm" onClick={onLogin} className="h-9 shrink-0 gap-2 rounded-lg px-4">
      <LogIn className="h-4 w-4" />
      Đăng nhập
    </Button>
  );
}
