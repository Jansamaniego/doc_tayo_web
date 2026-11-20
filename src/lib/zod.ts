import { z } from 'zod';

// Zod's JIT compiles validators with `new Function`, which the Content-Security-Policy forbids
// (a `script-src` violation even when the probe is caught). Always import `z` from here.
z.config({ jitless: true });

export { z };
