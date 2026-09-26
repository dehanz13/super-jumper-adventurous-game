# Nova run history projection (local contract)

The Nova audit worker will call a server-only writer after replay verification. Its destination is a future `public.nova_run_history` table in Hearso's **existing** Supabase project. This document defines the wire and row contract without changing Hearso migrations or contacting its production project during the beta.9 release.

| Column | Type | Source |
| --- | --- | --- |
| `run_id` | UUID primary key | Verified event `runId`; one row per run. |
| `player_id` | Text | Trusted run record, not the browser. Account values refer to Hearso's existing `player_profiles.player_id`; guest values are pseudonymous. |
| `player_class` | Text (`guest` or `account`) | Verified event. |
| `score` | Nonnegative integer | Server replay. |
| `achieved_at` | Timestamptz | Verified event. |
| `event_version` | Integer | Verified event contract version. |
| `event_payload` | JSONB | The public-minimized `nova.run.verified` event for audit and future projection changes. |

The writer sends `POST /rest/v1/nova_run_history?on_conflict=run_id` with `Prefer: resolution=ignore-duplicates,return=minimal`. A retry of the same immutable event does not overwrite its first accepted row. A response in the 2xx range is the destination acknowledgement that the audit worker may save. Network failures and non-2xx responses keep the DynamoDB audit item pending for retry; response bodies and credentials are never included in worker errors or logs.

The server holds a modern Supabase `sb_secret_` key and sends it only as `apikey`. The browser never receives it. The eventual Hearso migration must create the primary key, enable RLS, revoke browser-role access, explicitly grant the server role only the required operations, and define account deletion and guest retention. The writer is tested against a local HTTP server; no table or credential is provisioned by this change.
