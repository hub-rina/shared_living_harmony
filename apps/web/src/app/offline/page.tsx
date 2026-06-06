import { CloudSlash } from '@phosphor-icons/react/dist/ssr';

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <CloudSlash size={48} weight="duotone" aria-hidden className="text-[color:var(--color-mood-stable)]" />
      <h1 className="text-2xl font-bold tracking-tight">You are offline</h1>
      <p className="max-w-prose text-sm text-[var(--text-mute)]">
        HOOMA needs a connection to load this page. Anything you finished or flagged while offline is
        saved on this device and will sync the moment you are back.
      </p>
    </main>
  );
}
