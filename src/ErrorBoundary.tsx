import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 p-4 text-center text-zinc-100">
          <h1 className="text-xl font-semibold">Có lỗi xảy ra</h1>
          <p className="text-sm text-zinc-400">Giao diện đã gặp lỗi bất ngờ. Hãy tải lại trang.</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false });
            }}
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
          >
            Tải lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
