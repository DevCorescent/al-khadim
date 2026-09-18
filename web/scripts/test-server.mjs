// Starts a dev server for the API tests: port 3200, its own build folder (so it can run
// beside `npm run dev`), and rate limiting disabled so repeated logins don't hit 429.
import { spawn } from 'node:child_process';

const port = process.env.TEST_PORT || '3200';
const child = spawn('npx', ['next', 'dev', '-p', port], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: '.next-test', DISABLE_RATE_LIMIT: 'true' },
});
child.on('exit', (code) => process.exit(code ?? 0));
