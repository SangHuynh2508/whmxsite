# WHMX Admin account operations

> **Entry point:** [`WHMX_CURRENT_STATE_FINAL_2026-09-26.md`](WHMX_CURRENT_STATE_FINAL_2026-09-26.md) (status, infrastructure, rules, backlog). Related: [`WHMX_APP_ARCHITECTURE.md`](WHMX_APP_ARCHITECTURE.md). Older handoffs, `WHMX_NEXT_STEPS.md` and finished plans were removed on 2026-09-26 — links to them below resolve in git history only.

Public self-signup is disabled. The one-time first-owner command is explicit:

```text
ADMIN_BOOTSTRAP_NAME=<display-name>
ADMIN_BOOTSTRAP_EMAIL=<email>
ADMIN_BOOTSTRAP_PASSWORD=<password>
npm run admin:bootstrap-owner
```

Set those values only in the operator's ignored local environment or a secure
process environment. Do not put them in source control, command arguments, or
shell history. The command refuses when an owner account already exists, and it
prints neither account identity nor credentials.

After bootstrap, an owner provisions editor or owner accounts through the
owner-only Admin API. Email invitations are intentionally deferred: without a
configured mail provider, the operator must transfer the initial credential by
an approved out-of-band process.

For a credential-password recovery, set these values only in an ignored local
environment or secure process environment, then run:

```text
ADMIN_PASSWORD_RESET_EMAIL=<existing-admin-email>
ADMIN_PASSWORD_RESET_NEW_PASSWORD=<12-to-128-character-password>
npm run admin:reset-password
```

The recovery command changes only an existing email/password credential. It
does not create a user or session, preserves role/status/profile fields, and
revokes existing sessions after a successful reset. It prints only a coarse
completion, user-not-found, or failure result; never put these values in
source control, command arguments, or shell history.

For development and deployment, configure `BETTER_AUTH_SECRET` as a server-only
secret and set `BETTER_AUTH_ALLOWED_HOSTS` to the exact authorized hosts. Local
defaults allow only `localhost:5173` and `localhost:3000`; production must use
HTTPS hosts explicitly listed in that variable.
