// Runs once when the Next.js server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startEmailScheduler } = await import('./server/scheduler/emailScheduler');
    startEmailScheduler();
  }
}
