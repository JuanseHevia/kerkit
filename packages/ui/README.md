# @kerkit/ui

"Calm Confidence" design tokens (and, in upcoming waves, React Native components) for caretaker apps.

> Part of [kerkit](https://github.com/JuanseHevia/kerkit). Not a medical device; see the project NOTICE.

## Tokens (`@kerkit/ui/tokens`)

Framework-agnostic design tokens extracted from a production caretaker app:

```ts
import { semantic, statusColors, typeScale, spacing } from '@kerkit/ui/tokens';

semantic.action.forward // #2E8B5E — the ONLY green. Forward progress, nothing else.
statusColors.escalation // { bg, fg } pair for the authorization state, AA-verified
```

## The philosophy, in rules

- **Green is forward progress.** `action.forward` is the only green surface. Decoration never gets it.
- **Warm neutrals.** The grays have a yellow undertone. No cold blues, no clinical teal.
- **No gamification, no dashboard overload, no infinite scroll.** The user is a stressed caretaker, not an engagement metric.
- **Body floor 15px, touch floor 44pt** (`MIN_TOUCH_TARGET`). Never below regular weight.
- **Elevation by border, not shadow.** Cards use hairline borders on warm backgrounds; shadows exist but are a last resort.
- **Status labels come from the locale pack** (`status.authorization.badge.*` keys), never hardcoded next to the colors.

## Components

Land in waves (StatusBadge, EmptyState, ActionCard, BottomSheet first). Peer dependencies will be `react-native` + `react-native-reanimated`; tokens stay dependency-free.
