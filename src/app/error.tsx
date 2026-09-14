'use client';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return <main className="error-page"><h1>The observatory lost its connection.</h1><p>Your paper state is retained by the running service.</p><button onClick={reset}>Reconnect</button></main>;
}
