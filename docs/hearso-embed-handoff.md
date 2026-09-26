# Hearso account and embedded-game handoff (local game-side contract)

The Nova run API now verifies the proposed ticket and consumes it atomically with a new account run when configured with a signing secret. The Hearso issuer, frame message handoff, runtime secret loading, and deployment are still pending. Without the secret, the account start route returns `501`; standalone guest play remains available without Hearso.

## Verified Hearso seams

Read-only inspection of `~/development/projects/hearso/hearso-web/` on 2026-09-25 found:

- `data/games.ts` is the Library registry. It currently admits only the `trivia` slug and `daily`/`live` modes. A solo arcade entry needs the type, route, and card semantics updated together; adding a card ahead of a working route would violate its existing registry rule.
- `lib/auth-server.ts` resolves Hearso's HTTP-only session cookies on the app server and validates the access token with Supabase Auth. A CloudFront game origin cannot read those cookies.
- `app/api/profile/route.ts` projects `playerId`, `displayName`, and `country` from a profile row. The account ticket issuer must read the authenticated profile rather than accept identity fields from a browser body. The profile creation path can default country to `US`, so the account country shown publicly may need explicit confirmation before use in a solo board.
- `lib/ws-ticket.ts` already defines a 30-second HMAC-signed, single-use cross-service ticket for WebSocket rooms. It has a versioned format, audience, `jti`, issue/expiry times, rotation support, and fixed vectors shared with its verifier. Nova needs a **separate audience and signing secret**; a WebSocket room ticket must never authorize a game run.

These source seams do not prove a deployed Hearso route or a production ticket issuer for Nova. The Hearso repository's agent brief requires a Linear release-plan check and CodeRabbit review before changes there; the Linear connection needs reauthentication, so no Hearso files were changed in this pass.

## Proposed sequence

1. The Hearso game page embeds the standalone game from an exact configured HTTPS origin. The frame sends a nonsecret `ready` message. The parent accepts it only from the expected `event.source` and game origin.
2. The parent calls a same-origin Hearso POST route. That route resolves the account session, reads the server-owned profile, and mints a ticket with a dedicated `nova-orbit-jump` audience, a unique `jti`, a short fixed lifetime, and only `playerId`, public `displayName`, and confirmed `country`. It returns `Cache-Control: no-store`.
3. The parent sends the ticket to the frame with an exact `targetOrigin`; the frame accepts it only from the expected parent window and Hearso app origin. Neither side puts the ticket in a URL, local storage, analytics, or logs.
4. The frame sends `{ launchTicket }` to `POST /v1/runs`. The game-owned Lambda verifies signature, audience, lifetime, and identity shape with a dedicated runtime secret. A DynamoDB transaction consumes `TICKET#<jti>` and creates the active run together. A duplicate ticket cannot issue a second run.
5. The existing finish verifier chooses weekly plus all-time boards from the stored `account` player class. It does not trust a browser field to choose account status, score, country, or board selection.

The ticket wire format is `v1.<payload_b64url>.<signature_b64url>`. The compact JSON payload has keys in this order: `v`, `jti`, `sub`, `name`, `country`, `aud`, `iat`, `exp`. `v` is `1`; `aud` is `nova-orbit-jump`; `iat` and `exp` are Unix milliseconds exactly 30 seconds apart. The signature is base64url HMAC-SHA256 over `v1.<payload_b64url>` using a **Nova-only** secret of at least 32 UTF-8 bytes. The verifier accepts current and previous secrets during rotation and allows five seconds of clock skew. The issuer must mint a unique 16–40 character `jti` and get `sub`, `name`, and `country` from a verified Hearso account/profile. The API answers invalid or reused tickets with a safe 401 and never echoes claims or signatures. The game-side implementation and DynamoDB Local tests cover atomic consumption; the Hearso issuer must later share a fixed signed vector with this verifier.

## Remaining Hearso integration decisions

- Confirm Nova's Hearso Library slug and standalone game origin, then keep the leaderboard `game-id` distinct from Trivia.
- Decide how an account holder confirms the public country when a Hearso profile may contain a default `US` value.
- Decide whether the embedded page should offer guest play while a Hearso account session exists. The game must not silently downgrade an account run after a ticket failure.
- Wait for Hearso v1.0.0-beta.9 before changing `hearso-web`; its branch and review gates apply there independently of this game repository.
