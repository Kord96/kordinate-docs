import type { Plugin } from 'vite';
import { parse as parseCookie } from 'cookie';

// Paths as seen by Vite (base path is stripped by Astro)
const LOGIN_PATH = '/login';
const COOKIE_NAME = 'dev-auth';

/**
 * Vite dev-server plugin that gates all pages behind a password.
 * Runs before Astro routing so it has full access to Node req/res.
 * Only active during `npm run dev` — has no effect on static builds.
 */
export default function devAuthPlugin(): Plugin {
  return {
    name: 'dev-auth',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '/';

        // Let Vite internals, static assets, and HMR through
        if (url.startsWith('/@') || url.startsWith('/__') ||
            url.startsWith('/node_modules/') ||
            url.match(/\.(css|js|ts|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|map)(\?|$)/)) {
          return next();
        }

        const cookies = parseCookie(req.headers.cookie ?? '');

        // Login page
        if (url === LOGIN_PATH || url === `${LOGIN_PATH}/` || url.startsWith(`${LOGIN_PATH}?`)) {
          // Already authed — redirect to home
          if (cookies[COOKIE_NAME] === 'ok') {
            res.writeHead(302, { location: '/dev/' });
            return res.end();
          }

          // POST — validate password
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            req.on('end', () => {
              const params = new URLSearchParams(body);
              const password = params.get('password') ?? '';
              const expected = process.env.DEV_PASSWORD ?? 'dev';

              if (password === expected) {
                res.writeHead(302, {
                  location: '/dev/',
                  'set-cookie': `${COOKIE_NAME}=ok; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`,
                });
                return res.end();
              }

              // Wrong password
              res.writeHead(302, {
                location: '/dev/login',
                'set-cookie': `dev-auth-error=1; Path=/; Max-Age=10`,
              });
              return res.end();
            });
            return;
          }

          // GET — render login page (pass through to Astro)
          return next();
        }

        // All other pages — require auth
        if (cookies[COOKIE_NAME] !== 'ok') {
          res.writeHead(302, { location: '/dev/login' });
          return res.end();
        }

        next();
      });
    },
  };
}
