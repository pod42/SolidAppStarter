# AI Scaffolding Prompt

Use the prompt below with **GitHub Copilot Chat** (or any AI assistant) to generate
your application inside this template. Paste it, then describe your specific app.

---

## How to use

1. Open GitHub Copilot Chat in VS Code (`Ctrl+Alt+I`)
2. Copy the entire prompt block below
3. Replace `[DESCRIBE YOUR APP HERE]` with what you want to build
4. Send it — Copilot will generate a complete `AppShell.jsx` replacement

---

## The Prompt

```
I am working inside a Solid Pod web app starter kit. The framework is already set
up — authentication, pod utilities, UI primitives, and styles are all done.

My only task is to replace `src/components/AppShell.jsx` with a working application.

**What I want to build:**
[DESCRIBE YOUR APP HERE]

---

**Framework context:**

Tech stack: React 19 + Vite, no TypeScript, plain JSX + ES modules.

The AppShell receives these props:
  - session      — Solid session object; use session.fetch for all pod requests
  - webId        — the logged-in user's WebID string
  - onLogout     — call this to log the user out

Available utilities (import from '../utils/solid.js'):
  - fetchProfile(webId, session.fetch)
      → { name, storageRoot, avatar }
  - listContainer(containerUrl, session.fetch)
      → [{ url, name, isFolder, modified, size }]
  - createFolder(url, session.fetch)
  - uploadFile(targetUrl, blobOrFile, session.fetch)
  - deleteResource(url, session.fetch)
  - moveResource(sourceUrl, destUrl, session.fetch)
  - copyFile(sourceUrl, destUrl, session.fetch)
  - getFileObjectUrl(url, session.fetch)
      → { objectUrl, mimeType }
  - setPublicRead(url, isPublic, session.fetch)
  - setAgentAccess(url, agentWebId, { read, write, append, control }, session.fetch)
  - ensureOwnInboxAppendable(webId, session.fetch)   ← ALWAYS call in init
  - sendShareNotification(recipientWebId, resourceUrl, resourceName, senderWebId, session.fetch)
  - getSharedWithMe(webId, session.fetch)
      → [{ url, name, sharedBy, notifUrl }]

Available mock utilities (import from '../utils/mockStorage.js'):
  - Same API as solid.js but backed by localStorage
  - Switch with: const ops = MOCK_MODE ? mockOps : solidOps;
    where MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true'

UI hooks:
  - useToast() from '../hooks/useToast.js'
      → { toasts, addToast(msg, type), removeToast(id) }
      type: 'success' | 'error' | 'info' | 'warning'

Pre-built UI components (already styled):
  - <Modal isOpen onClose title size="sm|md|lg|xl">
      from './Modal.jsx'
  - <ToastContainer toasts onRemove>
      from './Toast.jsx'
  - <SupportModal isOpen onClose webId activeView>
      from './SupportModal.jsx'

CSS design tokens (use in inline styles or className):
  --sd-blue, --sd-blue-dark, --sd-blue-light
  --sd-green, --sd-text, --sd-text-2
  --sd-border, --sd-bg, --sd-surface
  --sd-shadow, --sd-radius (8px), --sd-font

Pre-built CSS classes:
  .btn-primary .btn-outline .spinner-lg .spinner-sm
  .app-shell .app-shell-header .app-shell-title .app-shell-user .app-shell-username
  .app-shell-main .app-mock-banner
  .modal-backdrop .modal-box .modal-sm/md/lg/xl .modal-header .modal-title
  .modal-close .modal-body

**Standard init pattern to follow in useEffect:**
```js
const p = await ops.fetchProfile(webId, session.fetch);
setProfile(p);
const root = p.storageRoot + 'YOUR-APP-SLUG/';
setAppRoot(root);
try {
  const r = await session.fetch(root, { method: 'HEAD' });
  if (r.status === 404) await ops.createFolder(root, session.fetch);
} catch {
  await ops.createFolder(root, session.fetch);
}
await ops.ensureOwnInboxAppendable(webId, session.fetch);
// now load your data
```

**Data storage pattern (Solid spec — JSON-LD):**

Solid is built on Linked Data. Store structured items as JSON-LD (application/ld+json)
with a @context that maps fields to vocabulary terms. This keeps data interpretable
by other Solid apps. JSON-LD is valid JSON — session.fetch(...).json() works unchanged.

Write a record:
```js
const record = {
  '@context': {
    '@vocab': 'https://schema.org/',
    'dcterms': 'http://purl.org/dc/terms/',
  },
  '@id': appRoot + item.id,        // the resource URL becomes the RDF subject
  '@type': 'Thing',                // use a specific type — see vocabulary note below
  'name': item.name,
  'description': item.description,
  'dcterms:created': item.created,
  'dcterms:modified': new Date().toISOString(),
};
const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/ld+json' });
await ops.uploadFile(appRoot + item.id + '.jsonld', blob, session.fetch);
```

Read all records:
```js
const files = await ops.listContainer(appRoot, session.fetch);
const loaded = await Promise.all(
  files
    .filter(f => !f.isFolder && f.name.endsWith('.jsonld'))
    .map(async f => {
      const r = await session.fetch(f.url);
      return r.ok ? r.json() : null;
    })
);
const items = loaded.filter(Boolean);
```

Delete a record:
```js
await ops.deleteResource(appRoot + item.id + '.jsonld', session.fetch);
```

Common schema.org @type values to use:
- 'Note' or 'Article'     — notes / text content
- 'Event'                 — calendar entries
- 'Place'                 — locations / map pins
- 'Product'               — inventory items
- 'Person'                — contacts / address book
- 'CreativeWork'          — generic structured records

Common vocabulary fields:
- schema: name, description, dateCreated, dateModified, identifier, url, image
- dcterms: created, modified, title, subject
- Always include '@id' set to the resource URL so the record is self-describing

Note: plain application/json is acceptable for app-private data that will never be
shared or accessed by other Solid apps, but JSON-LD is strongly preferred for
anything user-facing or potentially shared.

**Code conventions:**
- Never use bare fetch() for pod resources — always use session.fetch
- Show user-visible errors with addToast('message', 'error')
- Use console.error() for debug logging
- No TypeScript — plain JSX + vanilla JS
- Add component-specific CSS at the bottom of src/app.css using the --sd-* tokens

**Known Solid Pod quirks:**
- createFolder() on an existing container returns 409 → always HEAD-check first
- Wrap HEAD checks in try/catch (404s may lack CORS headers)
- Never use getSolidDatasetWithAcl() on non-RDF files → use getResourceInfoWithAcl()
- deleteResource() handles recursive container deletion

Please generate a complete replacement for src/components/AppShell.jsx that
implements my app. Include all necessary state, the init sequence, CRUD operations,
and a clean UI using the existing design tokens and CSS classes.
Also list any new CSS rules I should add to src/app.css.
```

---

## Tips

- Be specific: "a recipe manager that stores recipes with name, ingredients (array),
  and steps (array) as JSON-LD using schema:Recipe" works much better than "a recipe app"
- Specify your data type: tell Copilot which schema.org `@type` fits your data so it
  picks the right vocabulary fields (e.g. schema:Recipe, schema:Event, schema:Place)
- Mention any UI preferences: "use a card grid layout", "include a search bar",
  "show a sidebar navigation"
- Ask for sharing support: "allow users to share items with other pod users by WebID"
- For complex apps, ask Copilot to scaffold one feature at a time and build incrementally
