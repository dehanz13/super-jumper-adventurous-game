# Standalone static hosting (local template only)

`infra/static-site-stack.ts` defines a separate CDK stack for the Vite game. It has not been deployed. The stack creates a private, versioned S3 bucket and a CloudFront distribution that reads the bucket through signed Origin Access Control. The bucket has no website endpoint or public read access.

The distribution serves `index.html` at `/`. Its default behavior disables caching so new HTML can point to the latest build. The `assets/*` behavior caches Vite's fingerprinted JavaScript, CSS, and media. Both behaviors redirect HTTP to HTTPS. There is no blanket 403/404-to-HTML rewrite, because a missing asset should remain an error rather than silently returning `index.html`.

CloudFront sends a `frame-ancestors` policy that permits its own origin and one exact Hearso HTTPS origin supplied through `HearsoEmbedOrigin`. This is the origin of the parent page, not the path of a specific game card. The policy deliberately has no `X-Frame-Options` header, which would conflict with cross-origin embedding. The stack also sets HSTS, `nosniff`, and a strict referrer policy. The exact Hearso origin needs confirmation before deployment.

Use Node 22 to inspect both infrastructure templates locally:

```sh
npm ci
npm run infra:typecheck
npm run infra:synth
```

`cdk.out/NovaStaticSite.template.json` is generated and ignored by Git. The static stack outputs the bucket name, distribution ID, and CloudFront URL. It does not upload `dist/`, create DNS or a certificate, deploy the run API, or publish a game. A later release workflow must use `npm run build:ranked` with approved public HTTPS `/v1` values for `VITE_RUN_API_BASE_URL` and `VITE_LEADERBOARD_API_BASE_URL`, upload the resulting files with correct content types, verify the game and leaderboard from the public origin, and only then switch public links. The ranked build command rejects missing, local, credential-bearing, or non-v1 URLs before running Vite; it does not test endpoint reachability or CORS. The run API's `AllowedOrigins` parameter must include this exact game origin. Embedding also needs a compatible Hearso parent-page frame policy.

The CDK test checks the private bucket, signed origin access, HTTPS behavior, cache split, and frame policy. A real AWS launch still needs account-level checks of CloudFront behavior, CORS, domain ownership, release rollback, and operations alerts.
