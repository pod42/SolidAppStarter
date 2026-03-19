---
description: "Generate a complete Solid Pod application from scratch. Use when starting a new app from the PDPAppTemplate."
agent: "agent"
argument-hint: "Describe your app — e.g. 'a recipe manager that stores recipes on my pod'"
---

# Create a Solid Pod Application

You are building a production-quality web application on top of the PDPAppTemplate. The infrastructure layer (auth, Solid utilities, CSS tokens, deploy) is already in place. Your job is to build the application-specific UI and data layer by replacing `src/components/AppShell.jsx`.

## Step 1 — Understand the app

The user wants to build: **{{input}}**

Before writing any code, think through:
1. **What data does this app store on the pod?** (files, RDF documents, JSON resources, containers)
2. **What is the app data root?** (e.g. `storageRoot + 'recipes/'`)
3. **What are the main screens / views?** (list, detail, create, edit, settings…)
4. **What Solid operations are needed?** (list, upload, read, write, delete, share, WAC)
5. **What components need to be built?** List them — name and purpose for each

## Step 2 — Confirm the plan

Output a short plan in this format before writing any code:

```
APP: <name>
DATA ROOT: storageRoot + '<folder>/'
DATA FORMAT: <how data is stored — e.g. "one JSON file per item", "folder per record", "raw files">

SCREENS:
  - <ScreenName>: <what it shows/does>

COMPONENTS TO BUILD:
  - <ComponentName>.jsx: <one-line purpose>

SOLID OPERATIONS USED:
  - <function from solid.js>: <why>
```

Then proceed to implement.

## Step 3 — Update .env.example

Update `VITE_APP_NAME`, `VITE_APP_SHORT_NAME`, and `VITE_APP_DESCRIPTION` in `.env.example` to match the new app.

## Step 4 — Build AppShell.jsx

Replace `src/components/AppShell.jsx` with the full application. Follow this structure:

```jsx
import { useState, useEffect, useCallback } from 'react';
import ToastContainer from './Toast.jsx';
import { useToast } from '../hooks/useToast.js';
import {
  fetchProfile,
  ensureOwnInboxAppendable,
  // ...other solid.js imports as needed
} from '../utils/solid.js';

export default function AppShell({ session, webId, onLogout }) {
  const { toasts, addToast, removeToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [appRoot, setAppRoot] = useState(null);
  const [loading, setLoading] = useState(true);
  // ...app-specific state

  useEffect(() => {
    async function init() {
      try {
        const p = await fetchProfile(webId, session.fetch);
        setProfile(p);
        const root = p.storageRoot + 'YOUR-APP-FOLDER/';
        setAppRoot(root);
        // HEAD-check app root, create if 404
        try {
          const r = await session.fetch(root, { method: 'HEAD' });
          if (r.status === 404) await createFolder(root, session.fetch);
        } catch { await createFolder(root, session.fetch); }
        await ensureOwnInboxAppendable(webId, session.fetch);
        // Load initial data...
      } catch (err) {
        console.error('Init error:', err);
        addToast('Could not load. Check your pod connection.', 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [webId]);

  // ...handlers

  if (loading) return <div className="app-loading"><span className="spinner-lg" /></div>;

  return (
    <div className="app-shell">
      {/* Your UI here */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
```

## Step 5 — Build additional components

Create each component listed in the plan as a separate file in `src/components/`. Import them into AppShell.

## Step 6 — Add styles

Add all component styles to `src/app.css` using the existing design tokens (`--sd-blue`, `--sd-surface`, etc.). Do not create separate CSS files.

## Step 7 — Update public/client-id.json

Replace `YOUR-APP-DOMAIN` with the value from `VITE_APP_DOMAIN` in `.env.example`.

## Rules to follow

- **Never** use bare `fetch()` for pod resources — always use `session.fetch`
- **Never** string-concatenate pod URLs — use `buildFileName()` / `buildContainerUrl()`
- **Always** show `addToast('...', 'error')` for user-visible errors
- **Always** HEAD-check before `createFolder()` — CSS returns 409 on existing containers
- **Always** use `getResourceInfoWithAcl()` (not `getSolidDatasetWithAcl()`) for WAC operations
- Use plain JSX + vanilla JS — no TypeScript
- Keep all styles in `src/app.css`
- Reuse `Modal.jsx` for dialogs, `SupportModal.jsx` is already wired into LoginScreen
