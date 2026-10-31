# Silly Goose Mutual — mobile app (React Native / Expo)

Synthetic demo content — not an insurance contract or coverage advice.

Expo app (iOS + Android development builds) that talks to the Silly Goose
Mutual web/API deployment. Features: demo-password gate, search-first home,
product/state scope chips, library browse, guide detail with approval
history, and an in-app source-PDF viewer.

## Configure

`app.json → expo.extra.apiBaseUrl` points at the API (default:
`https://silly-goose-mutual.onrender.com`). For a local dev server use your
machine's LAN IP, e.g. `http://192.168.x.x:3100` — never `localhost` on a
physical device. No secrets are bundled: the demo password is verified
server-side and only the short-lived session token is kept in secure storage.

## Run

```bash
pnpm install
pnpm --filter mobile start          # Expo dev server (use a dev build / Expo Go)
pnpm --filter mobile android        # dev build on connected Android device/emulator
pnpm --filter mobile ios            # dev build on iOS simulator (macOS required)
pnpm --filter mobile typecheck
```

`react-native-pdf` is a native module — use an Expo dev client
(`expo run:android` / `expo run:ios`), not Expo Go, for the PDF viewer.
