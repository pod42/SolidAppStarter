# SolidAppStarter

A React starter kit for building web apps that store user data on [Solid Pods](https://solidproject.org).

Authentication, pod storage, UI components, and deployment are all pre-built. You only write your app's feature — everything else is done.

---

## Get Started in 5 Minutes

**Prerequisites:** Node.js 20+

```bash
git clone https://github.com/pod42/SolidAppStarter.git my-app
cd my-app
npm install
cp .env.example .env
npm run dev
```

Sign in at `http://localhost:5173` with a free [privatedatapod.com](https://privatedatapod.com) account. You'll see the "Ready to build" placeholder — your pod is connected.

**To build your app**, open `PROMPT.md` and follow the instructions. Copy the prompt into GitHub Copilot Chat, describe what you want to build, and Copilot generates a complete working `AppShell.jsx`.

---

## How It Works

The only file you replace is `src/components/AppShell.jsx`. Everything else is stable framework code — don't modify it.

```
src/
  components/
    AppShell.jsx      ← ★ replace this with your app
    LoginScreen.jsx   ← OIDC login UI (pre-built)
    Modal.jsx         ← accessible modal (pre-built)
    Toast.jsx         ← notifications (pre-built)
    SupportModal.jsx  ← support dialog (pre-built)
  hooks/
    useAuth.js        ← Solid OIDC session (do not modify)
    useToast.js       ← toast hook (do not modify)
  utils/
    solid.js          ← all pod operations (do not modify)
    mockStorage.js    ← localStorage mock for dev/testing
  lib/
    errorLog.js       ← error capture (do not modify)
```

---

## Configuration

Edit `.env` with your app name and domain:

```env
VITE_APP_NAME=My App
VITE_APP_DOMAIN=my-app.example.com
VITE_SUPPORT_EMAIL=support@example.com
```

Edit `public/client-id.json` — replace `YOUR-APP-DOMAIN` with your production domain. This file must be publicly reachable at that URL for Solid login to work. `localhost:5173` is pre-configured for local dev.

---

## Mock Mode (no pod required)

Add `VITE_MOCK_MODE=true` to `.env` to develop without a Solid Pod. Data is stored in `localStorage` and login is skipped.

---

## Deployment

**PrivateDataPod.com (recommended — no AWS needed):**
```powershell
npm run package   # builds and zips — upload the zip at privatedatapod.com
```

**AWS S3 + CloudFront:**
```powershell
.\deploy\deploy.ps1 -Domain "my-app.example.com"          # first deploy
.\deploy\deploy.ps1 -Action update -Domain "my-app.example.com"  # updates
```

---

## Further Reading

- `PROMPT.md` — AI scaffolding prompt (start here)
- `CONTEXT.md` — full framework API reference (solid.js utilities, CSS tokens, init patterns)

---

## License

MIT

