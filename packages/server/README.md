# @kerkit/server

Server toolkit for caretaker apps: PostgreSQL schema, repositories, privacy endpoints, and cron skeletons. Peer dependencies: `drizzle-orm`, `express`. **Bring your own auth** — every factory takes a `getUserId(req)` function; kerkit never touches credentials.

> Part of [kerkit](https://github.com/JuanseHevia/kerkit). Not a medical device; see the project NOTICE.

```ts
import {
  createKerkitSchema,
  createKerkitRepositories,
  createDrizzlePrivacyStore,
  createPrivacyRouter,
  createEscalationJob,
} from '@kerkit/server';
import { argentina } from '@kerkit/pack-argentina';
import { drizzle } from 'drizzle-orm/postgres-js';

// 1. Schema — extend any table with your own columns (see EXTENDING.md)
const tables = createKerkitSchema({
  extend: { appointments: { /* copayArs: integer('copay_ars') */ } },
});

const db = drizzle(connection);

// 2. Repositories — satisfy @kerkit/core interfaces; plug into @kerkit/ai
const repos = createKerkitRepositories(db, tables);

// 3. Privacy endpoints — export / delete / consents, audited by default
app.use(
  '/api/privacy',
  createPrivacyRouter({
    store: createDrizzlePrivacyStore(db, tables),
    getUserId: (req) => yourAuth.resolveUser(req),
  }),
);

// 4. Cron — one pass per run(); schedule with whatever you like
const escalation = createEscalationJob({ db, tables, onEscalation: notifyCaretaker });
setInterval(() => escalation.run(), 60 * 60 * 1000);
```

## What's deliberately NOT here

- **Auth** — `getUserId` is the seam; Clerk/Auth0/sessions are your call.
- **Email/calendar vendor glue** — implement `ExternalSources` from `@kerkit/core` with your Composio/Google integration.
- **Job scheduling** — `run()` does one pass; pick your own scheduler/queue.
- **Audit retention** — the `audit_events` table exists and privacy routes write to it; the retention policy is yours.

## Migrations

`createKerkitSchema` returns plain Drizzle tables — point `drizzle-kit` at the module where you call it and generate migrations as usual.
