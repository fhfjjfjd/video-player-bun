import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 p-4 text-center text-zinc-100">
          <h1 className="text-2xl font-bold tracking-tight">Có lỗi xảy ra</h1>
          <p className="text-sm text-zinc-400">Giao diện đã gặp lỗi bất ngờ. Hãy tải lại trang.</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false });
            }}
            className="rounded-full bg-brand-gradient px-6 py-2.5 text-sm font-semibold text-zinc-950 shadow-brand transition hover:brightness-110"
          >
            Tải lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
