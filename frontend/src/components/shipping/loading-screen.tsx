"use client";

export function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-4 bg-[var(--bg-base)] px-6 text-text-secondary">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-border-default border-t-accent-amber"
        aria-hidden
      />
      <p className="text-sm">{message}</p>
    </div>
  );
}
