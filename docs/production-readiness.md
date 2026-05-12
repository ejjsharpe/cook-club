# Production Readiness

## Domains

- API/auth Worker: `https://api.cookclub.app`
- Images Worker: `https://images.cookclub.app`
- Production images R2 S3 API: `https://46fa47bc2bba51d75383b4dfe6e3deb1.r2.cloudflarestorage.com/cook-club-images`
- Mobile deep link scheme: `cookclub://`

Before release, add `cookclub.app` to Cloudflare and verify the custom domains in the Worker routes.

## Auth Routes

- Better Auth base URL: `https://api.cookclub.app/auth`
- Google callback: `https://api.cookclub.app/auth/callback/google`
- Facebook callback: `https://api.cookclub.app/auth/callback/facebook`
- Apple callback: `https://api.cookclub.app/auth/callback/apple`
- Mobile callback URL: `cookclub://`

## Required Secrets

Set these for `cookclub-api` production:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FB_CLIENT_ID`
- `FB_CLIENT_SECRET`
- `RESEND_API_KEY`
- `APPLE_CLIENT_ID`
- `APPLE_CLIENT_SECRET`
- `APPLE_BUNDLE_IDENTIFIER`

Set these for `cookclub-images` production:

- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

## Cloudflare Protection

The API Worker uses Rate Limiting bindings for:

- `API_RATE_LIMITER`: broad API Worker IP burst protection
- `AI_RATE_LIMITER`: authenticated per-user AI burst protection
- `IMAGE_AI_RATE_LIMITER`: authenticated per-user image AI burst protection
- `UPLOAD_RATE_LIMITER`: authenticated per-user upload URL burst protection

Also configure Cloudflare WAF/rate limiting rules at the zone level for:

- `/auth/*` login/signup bursts by IP
- `/trpc/*` abusive IP request volume
- Known bad bots and countries only if that fits the launch market

Use durable DB-backed quotas later only for hard daily/monthly AI budgets or billing.

## Database

Run migrations before deploying the production mobile build. The migration history has been squashed pre-launch, so `0000_initial_schema.sql` is the baseline schema for a fresh database.

For a clean pre-launch reset:

1. `bun run --cwd packages/db migrate`
2. `bun run --cwd packages/db seed:reset`

For the production env file:

1. `bun run --cwd packages/db migrate:prod`
2. `bun run --cwd packages/db seed:prod`

The production seed script prompts before clearing. For a deliberate non-interactive pre-launch reset, run `SEED_CLEAR=true bun run --cwd packages/db seed:prod`.

## Store/Provider Notes

If Google sign-in is available on iOS, keep Sign in with Apple enabled and configured before App Store submission.
