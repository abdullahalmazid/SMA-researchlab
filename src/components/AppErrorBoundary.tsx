import React from "react";

interface State { error: Error | null }
export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error("Page render failed", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-4 py-16 text-center">
        <div className="w-full rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-black text-slate-900">This page could not be displayed</h1>
          <p className="mt-3 text-sm text-slate-600">A profile contains missing or incompatible data. The rest of the website is still available.</p>
          <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600">{this.state.error.message}</p>
          <button type="button" onClick={() => { this.setState({ error: null }); window.location.assign("/collaborators"); }} className="mt-6 rounded-xl border-0 bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">Back to collaborators</button>
        </div>
      </main>
    );
  }
}
