# Meeticket Mobile Web

Mobile-only React screens. Open `/srp` for Journey Options.

## Run

```bash
npm install
npm run dev
```

Then open:

- `/` search (from / destination)
- `/srp` journey options
- `/srp/:routeId` journey detail

## Data

Journey data lives in `src/constants/journey.ts`. Screens receive it as props.

To switch to a live API, replace `getRouteList()` and `getRouteById()` in that file.

## Integrate `SrpPage`

```tsx
import { SrpPage, type RouteOption } from './features/srp'
import { getRouteList } from './constants/journey'

<SrpPage
  routeList={getRouteList()}
  onSelectRoute={(route) => goToNextPage(route)}
  onBack={() => goBack()}
/>
```
