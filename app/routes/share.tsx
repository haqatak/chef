export default function Share() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <h1 className="mb-4 font-display text-4xl font-bold tracking-tight text-content-primary">Sharing is disabled</h1>
      <p className="mb-4 text-balance text-content-secondary">
        Sharing is not available in "demo mode." To enable sharing, you will need to re-enable authentication.
      </p>
      <a
        href="/"
        className="inline-flex items-center gap-2 rounded-lg bg-bolt-elements-button-primary-background px-4 py-2 text-bolt-elements-button-primary-text transition-colors hover:bg-bolt-elements-button-primary-backgroundHover"
      >
        <span className="text-sm font-medium">Return home</span>
      </a>
    </div>
  );
}
