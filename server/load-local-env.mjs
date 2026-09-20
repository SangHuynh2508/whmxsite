import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

// `vercel dev` may load `.env` but omit `.env.local` when both files exist.
// Server modules need the latter for local-only credentials. Deployment
// environments do not include this ignored file, and already-injected values
// always take precedence.
async function loadMissingLocalEnvironment() {
  let source;
  try {
    source = await readFile(join(process.cwd(), '.env.local'), 'utf8');
  } catch {
    return;
  }

  for (const [name, value] of Object.entries(parseEnv(source))) {
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

await loadMissingLocalEnvironment();
