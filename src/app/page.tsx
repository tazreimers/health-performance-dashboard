export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans text-zinc-950">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
          Health Performance
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Your training and recovery, together.
        </h1>
        <p className="mt-4 max-w-xl leading-7 text-zinc-600">
          Your dashboard is being set up. Once Garmin and WHOOP connections are
          available, this is where your daily recovery, sleep, and training
          data will come together.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 p-4">
            <p className="font-medium">Garmin</p>
            <p className="mt-1 text-sm text-zinc-500">
              Developer access pending
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-4">
            <p className="font-medium">WHOOP</p>
            <p className="mt-1 text-sm text-zinc-500">
              Connection not configured
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
