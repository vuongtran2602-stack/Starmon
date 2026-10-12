import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Error Caught by Boundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetData = () => {
    try {
      // Clear corrupt game save keys only
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.startsWith('starmon_game_save') || k.startsWith('starmon_accounts')) {
          localStorage.removeItem(k);
        }
      }
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full bg-slate-900 border-2 border-amber-400 rounded-3xl p-6 sm:p-8 shadow-2xl text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-3xl mb-3 shadow-lg">
              ✨
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-game text-amber-300">
              Starmon Tactics & RPG
            </h1>
            <p className="text-sm text-slate-300 mt-2">
              Đang làm mới dữ liệu trò chơi. Vui lòng bấm nút bên dưới để tiếp tục!
            </p>

            {this.state.error && (
              <div className="my-4 p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-left w-full text-xs text-rose-300 font-mono overflow-auto max-h-24">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full mt-3">
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black font-game text-sm shadow-xl cursor-pointer transition-transform active:scale-95"
              >
                🔄 Tải Lại Trò Chơi
              </button>
              <button
                onClick={this.handleResetData}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 cursor-pointer transition-transform active:scale-95"
              >
                Khởi Tạo Lại Lưu Trữ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
