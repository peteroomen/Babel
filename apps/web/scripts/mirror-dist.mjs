/**
 * Copy the built site to a `dist/` at the repository root as well as
 * `apps/web/dist`.
 *
 * Vercel's output-directory lookup for this project has not matched either
 * location on its own: a build emitting to apps/web/dist failed with
 * STATIC_BUILD_NO_OUT_DIR, and so did one emitting to the repository root.
 * Its install step reports 84 packages where a clean root install of this
 * workspace reports 272, so the build is not running where the repo root is,
 * but the project's rootDirectory is not readable through the API.
 *
 * Rather than keep guessing, publish to both. This is deliberately redundant
 * and should be deleted once the project's Root Directory setting is known.
 */
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

const from = fileURLToPath(new URL('../dist', import.meta.url));
const to = fileURLToPath(new URL('../../../dist', import.meta.url));

/* Clear first: copying over the top leaves every previous build's hashed
   bundles behind, which then ship with the site forever. */
await rm(to, { recursive: true, force: true });
await mkdir(to, { recursive: true });
await cp(from, to, { recursive: true });
console.log(`mirrored ${from} -> ${to}`);
