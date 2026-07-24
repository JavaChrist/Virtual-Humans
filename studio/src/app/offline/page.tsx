export const metadata = { title: "Hors ligne — Virtual Humans Studio" };

export default function OfflinePage() {
  return (
    <div className="max-w-md mx-auto mt-16 card p-6 text-center space-y-3">
      <div className="text-4xl">📡</div>
      <h1 className="text-xl font-bold">Tu es hors ligne</h1>
      <p className="text-sm text-[var(--muted)]">
        La génération d&apos;images, de voix et de vidéos nécessite une connexion internet
        (elle appelle des services externes). Reconnecte-toi puis réessaie.
      </p>
      <p className="text-xs text-[var(--muted)]">
        Les pages déjà visitées restent consultables hors ligne.
      </p>
    </div>
  );
}
