import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderActionsProps {
  user: string | null;
  onLogout: () => void;
  onLogin: () => void;
}

export function HeaderActions({ user, onLogout, onLogin }: HeaderActionsProps) {
  if (user) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300 sm:inline-flex">
          {user}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onLogout}
          aria-label="Đăng xuất"
          className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    );
  }
  return (
    <Button type="button" variant="secondary" onClick={onLogin} className="h-9 shrink-0 gap-2">
      <LogIn className="h-4 w-4" />
      Đăng nhập
    </Button>
  );
}
