# Extending kerkit entities

Every kerkit entity can be extended without forking, through three coordinated hooks. The pattern is the same for all entities; `Appointment` is the example.

## 1. Types — the `TExt` slot

Entity interfaces take an extra-fields type parameter:

```ts
import type { Appointment } from '@kerkit/core';

type MyAppointment = Appointment<{ copayArs: number }>;
```

## 2. Zod — `.extend()` the base schema

Schemas are exported un-frozen:

```ts
import { createAppointmentSchema } from '@kerkit/core';
import { z } from 'zod';

const createMyAppointment = createAppointmentSchema.extend({
  copayArs: z.number().int().nonnegative(),
});
```

## 3. Database — the schema factory `extend` map (`@kerkit/server`)

```ts
import { createKerkitSchema } from '@kerkit/server';
import { integer } from 'drizzle-orm/pg-core';

const tables = createKerkitSchema({
  extend: {
    appointments: { copayArs: integer('copay_ars') },
  },
});
```

## 4. Classify your new fields

If your field contains personal data, register its classification so redaction covers it:

```ts
import { extendClassification, appointmentClassification } from '@kerkit/core';

const myAppointmentClassification = extendClassification(appointmentClassification, {
  copayArs: 'logistics',
});
```

Unclassified fields are treated as `sensitive-health` (the most restrictive default) by the redaction engine — extensions fail safe, not open.

That's the whole mechanism. There is intentionally no runtime plugin system.
