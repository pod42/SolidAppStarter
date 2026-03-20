# SolidAppStarter

A React starter kit for building web applications that store user data on [Solid Pods](https://solidproject.org).

Clone this repo, configure your app name and domain, then use the AI prompt in `PROMPT.md` to scaffold your feature into `AppShell.jsx`. Authentication, pod storage utilities, UI primitives, and deployment scripts are all pre-built.

The recommended pod provider is **[privatedatapod.com](https://privatedatapod.com)**.

---

## What Is a Solid Pod?

A Solid Pod is personal online storage that *you* control. Instead of your data living in a company's database, it lives in your Pod. Applications request permission to read or write it — you can revoke access at any time, or move your data to a different provider.

---

## Quick Start

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20+ |
| npm | 10+ |

### 1 — Clone and install

```bash
git clone https://github.com/pod42/SolidAppStarter.git my-app
cd my-app
npm install
```

### 2 — Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_APP_NAME=My Solid App
VITE_APP_SHORT_NAME=SolidApp
VITE_APP_DESCRIPTION=A web app backed by your Solid Pod
VITE_APP_DOMAIN=your-app-domain.com
VITE_THEME_COLOR=#1A73E8
VITE_BG_COLOR=#F8F9FA
VITE_SUPPORT_EMAIL=support@example.com
```

### 3 — Update the OIDC client registration

Edit `public/client-id.json` — replace every `YOUR-APP-DOMAIN` with your production domain:

```json
{
  "client_id": "https://your-app-domain.com/client-id.json",
  "client_name": "My Solid App",
  "redirect_uris": [
    "https://your-app-domain.com/",
    "http://localhost:5173/"
  ]
}
```

> **Why this file matters:** Solid identity providers validate the `client_id` URI during login. The file must be publicly reachable at that URL once deployed. For local dev, `http://localhost:5173/` is already included.

### 4 — Run locally

```bash
npm run dev
```

Open `http://localhost:5173`. Sign in with a Solid Pod account (create a free one at [privatedatapod.com](https://privatedatapod.com)). You'll see the "Ready to build" placeholder — your pod is connected.

### 5 — Build your app

Open `PROMPT.md` and follow the instructions to generate your application using AI.

---

## Development Without a Pod (Mock Mode)

Add to your `.env` to skip OIDC login and store data in browser `localStorage`:

```env
VITE_MOCK_MODE=true
```

---

## Project Structure

```
SolidAppStarter/
├── .env.example                    ← copy to .env and fill in
├── PROMPT.md                       ← AI scaffolding prompt (start here)
├── CONTEXT.md                      ← full framework API reference
├── deploy/
│   ├── package.ps1                 ← builds and zips for upload to privatedatapod.com
│   └── deploy.ps1                  ← direct AWS S3 + CloudFront deploy
├── public/
│   ├── client-id.json              ← Solid OIDC client registration (update your domain)
│   └── icons/                      ← PWA icons
├── src/
│   ├── App.jsx                     ← auth router: loading → login → app
│   ├── app.css                     ← all styles (design tokens, login, modal, toast, shell)
│   ├── index.css                   ← minimal reset only
│   ├── main.jsx                    ← entry point
│   ├── components/
│   │   ├── AppShell.jsx            ← ★ REPLACE THIS with your application
│   │   ├── LoginScreen.jsx         ← OIDC login UI
│   │   ├── Modal.jsx               ← generic accessible modal
│   │   ├── SupportModal.jsx        ← support email + diagnostics dialog
│   │   └── Toast.jsx               ← toast notification UI
│   ├── hooks/
│   │   ├── useAuth.js              ← OIDC session state  (do not modify)
│   │   └── useToast.js             ← toast state hook    (do not modify)
│   ├── lib/
│   │   └── errorLog.js             ← ring-buffer error logger (do not modify)
│   └── utils/
│       ├── solid.js                ← all Solid Pod operations (do not modify)
│       ├── fileUtils.js            ← URL builders, file type helpers (do not modify)
│       └── mockStorage.js          ← localStorage mock for VITE_MOCK_MODE
├── capacitor.config.json           ← iOS/Android config (optional)
└── vite.config.js
```

**The only file you replace** is `src/components/AppShell.jsx`.  
Everything else is stable framework infrastructure.

---

## Building Your App

### Using the AI prompt (recommended)

Open `PROMPT.md` — it contains a ready-to-paste prompt for GitHub Copilot Chat (or any AI assistant). Fill in what you want to build and the AI will generate a complete `AppShell.jsx` using the correct patterns.

### Manually

The standard init sequence in `AppShell.jsx`:

```js
useEffect(() => {
  async function init() {
    // 1. Load profile → get storageRoot
    const p = await ops.fetchProfile(webId, session.fetch);
    setProfile(p);

    // 2. Define and create this app's data folder
    const root = p.storageRoot + 'my-app/';
    setAppRoot(root);
    try {
      const r = await session.fetch(root, { method: 'HEAD' });
      if (r.status === 404) await ops.createFolder(root, session.fetch);
    } catch {
      await ops.createFolder(root, session.fetch);
    }

    // 3. Set up inbox (required before any sharing features)
    await ops.ensureOwnInboxAppendable(webId, session.fetch);

    // 4. Load your data
    const items = await ops.listContainer(root, session.fetch);
  }
  init();
}, [webId]);
```

**Storing data (JSON-LD — Solid spec recommended):**

Solid is built on Linked Data. Use `application/ld+json` with a `@context` so data is
interpretable by other Solid apps. JSON-LD is valid JSON — `.json()` works unchanged.

```js
// Write
const record = {
  '@context': { '@vocab': 'https://schema.org/', 'dcterms': 'http://purl.org/dc/terms/' },
  '@id': appRoot + item.id,          // resource URL as the RDF subject
  '@type': 'Thing',                  // e.g. 'Note', 'Event', 'Place', 'Product'
  'name': item.name,
  'description': item.description,
  'dcterms:created': item.created,
  'dcterms:modified': new Date().toISOString(),
};
const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/ld+json' });
await ops.uploadFile(appRoot + item.id + '.jsonld', blob, session.fetch);

// Read all
const files = await ops.listContainer(appRoot, session.fetch);
const loaded = await Promise.all(
  files.filter(f => f.name.endsWith('.jsonld')).map(async f => {
    const r = await session.fetch(f.url);
    return r.ok ? r.json() : null;
  })
);

// Delete
await ops.deleteResource(appRoot + item.id + '.jsonld', session.fetch);
```

---

## Solid Utilities Reference

All functions are in `src/utils/solid.js`. Import what you need and always pass `session.fetch`.

| Function | Returns | Notes |
|---|---|---|
| `fetchProfile(webId, fetch)` | `{ name, storageRoot, avatar }` | |
| `listContainer(url, fetch)` | `[{ url, name, isFolder, modified, size }]` | System files filtered out |
| `createFolder(url, fetch)` | — | Uses POST+Slug (not PUT) |
| `uploadFile(url, blob, fetch)` | — | File or Blob |
| `deleteResource(url, fetch)` | — | Recursive for containers |
| `copyFile(src, dest, fetch)` | — | |
| `moveResource(src, dest, fetch)` | — | |
| `getFileObjectUrl(url, fetch)` | `{ objectUrl, mimeType }` | For download/preview |
| `setPublicRead(url, bool, fetch)` | — | WAC public read |
| `setAgentAccess(url, webId, perms, fetch)` | — | WAC per-user permissions |
| `ensureOwnInboxAppendable(webId, fetch)` | — | Creates inbox if missing |
| `sendShareNotification(...)` | — | LDN ActivityStreams notification |
| `getSharedWithMe(webId, fetch)` | `[{ url, name, sharedBy, notifUrl }]` | Validates + cleans stale entries |

---

## CSS Design System

All styles live in `src/app.css`. Use the design tokens for consistency with the existing UI:

| Token | Value | Use for |
|---|---|---|
| `--sd-blue` | `#1A73E8` | Primary actions |
| `--sd-blue-dark` | `#1557B0` | Hover states |
| `--sd-blue-light` | `#E8F0FE` | Highlighted backgrounds |
| `--sd-green` | `#34A853` | Success states |
| `--sd-text` | `#202124` | Primary text |
| `--sd-text-2` | `#5F6368` | Secondary text |
| `--sd-border` | `#DADCE0` | Borders |
| `--sd-bg` | `#F8F9FA` | Page background |
| `--sd-surface` | `#FFFFFF` | Cards, panels |
| `--sd-radius` | `8px` | Border radius |

**Pre-built classes:** `.btn-primary` `.btn-outline` `.spinner-lg` `.spinner-sm`

**Pre-built components:**

| Component | Import | Props |
|---|---|---|
| `Modal` | `./Modal.jsx` | `isOpen, onClose, title, size` (sm/md/lg/xl) |
| `ToastContainer` | `./Toast.jsx` | `toasts, onRemove` |
| `SupportModal` | `./SupportModal.jsx` | `isOpen, onClose, webId, activeView` |

---

## Deployment

### Option A — PrivateDataPod.com (recommended)

```powershell
npm run package
```

Builds the app and creates a zip in the project root. Upload it at [privatedatapod.com](https://privatedatapod.com). No AWS account required.

### Option B — AWS S3 + CloudFront

Requires the AWS CLI installed and configured.

```powershell
# First deploy — creates S3 bucket + CloudFront distribution
.\deploy\deploy.ps1 -Domain "myapp.example.com"

# Subsequent deploys
.\deploy\deploy.ps1 -Action update -Domain "myapp.example.com"

# Cache invalidation only
.\deploy\deploy.ps1 -Action invalidate
```

After the first deploy, point your DNS CNAME to the CloudFront domain printed in the output.

---

## Known Solid Server Quirks

| Quirk | Detail |
|---|---|
| **Container 409** | `createContainerAt()` returns 409 if the container already exists — always HEAD-check first |
| **WAC 501** | `getSolidDatasetWithAcl()` fails on non-RDF files — use `getResourceInfoWithAcl()` instead |
| **CORS on 404** | Some pod servers omit CORS headers on 404 responses — wrap HEAD checks in `try/catch` |
| **Inbox missing** | Fresh pods may have no inbox — `ensureOwnInboxAppendable()` creates it |

---

## FAQ

**Can I use any Solid pod provider?**  
Yes. The login screen includes fields for any OIDC provider URL. Change the featured provider in `LoginScreen.jsx`.

**Can I store RDF instead of JSON?**  
Yes. Use `getSolidDataset`, `getThing`, etc. from `@inrupt/solid-client`. See the [Inrupt docs](https://docs.inrupt.com/developer-tools/javascript/client-libraries/).

**Why no TypeScript?**  
Plain JSX keeps the code readable and AI-friendly for scaffolding. Add TypeScript by renaming files and adding a `tsconfig.json`.

**The build warns about chunk size.**  
This is expected — `@inrupt/solid-client` is large. The bundle is GZIP-compressed and efficiently cached by CloudFront.

---

## License

MIT — see `LICENSE` file.

