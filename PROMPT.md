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
// Check type index first — the user may already have a container from a previous session
const TYPE_URI = 'https://schema.org/REPLACE_WITH_YOUR_TYPE'; // ← see class URI table below
let root = await ops.findContainerForType(webId, p.storageRoot, TYPE_URI, session.fetch);
if (!root) {
  root = p.storageRoot + 'YOUR-APP-SLUG/';
  try {
    const r = await session.fetch(root, { method: 'HEAD' });
    if (r.status === 404) await ops.createFolder(root, session.fetch);
  } catch {
    await ops.createFolder(root, session.fetch);
  }
  await ops.registerTypeIndex(webId, p.storageRoot, TYPE_URI, root, session.fetch);
}
setAppRoot(root);
await ops.ensureOwnInboxAppendable(webId, session.fetch);
// now load your data
```

**Data storage pattern (Solid spec — JSON-LD):**

Solid is built on Linked Data. Store structured items as JSON-LD (application/ld+json)
with a @context that maps fields to vocabulary terms. This keeps data interpretable
by other Solid apps. JSON-LD is valid JSON — session.fetch(...).json() works unchanged.

Write a record:
```js
// IMPORTANT: the '@type' value here must match TYPE_URI in the init pattern above.
// With '@vocab': 'https://schema.org/', '@type': 'Place' resolves to https://schema.org/Place.
const record = {
  '@context': {
    '@vocab': 'https://schema.org/',
    'dcterms': 'http://purl.org/dc/terms/',
  },
  '@id': appRoot + item.id,        // the resource URL becomes the RDF subject
  '@type': 'CreativeWork',         // ← replace with your type (see class URI table below)
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

**Class URI table** — pick the type that fits your data. The pod home page at `{username}.privatedatapod.com`
shows a chip (icon + label) for each registered type. `@type` shorthand works when `@vocab` is `https://schema.org/`.

| `@type` shorthand | Full URI (`TYPE_URI`) | Pod home chip |
|---|---|---|
| `Place` | `https://schema.org/Place` | 📍 Places |
| `Event` | `https://schema.org/Event` | 📅 Events |
| `Recipe` | `https://schema.org/Recipe` | 🍳 Recipes |
| `ItemList` | `https://schema.org/ItemList` | 📋 Lists |
| `Article` | `https://schema.org/Article` | 📄 Articles |
| `Book` | `https://schema.org/Book` | 📚 Books |
| `Movie` | `https://schema.org/Movie` | 🎬 Movies |
| `TVSeries` | `https://schema.org/TVSeries` | 📺 Shows |
| `VideoGame` | `https://schema.org/VideoGame` | 🎮 Games |
| `MusicPlaylist` | `https://schema.org/MusicPlaylist` | 🎵 Music |
| `MusicRecording` | `https://schema.org/MusicRecording` | 🎵 Tracks |
| `Photograph` | `https://schema.org/Photograph` | 📷 Photos |
| `Collection` | `https://schema.org/Collection` | 🗂 Collections |
| `Note` (ActivityStreams) | `https://www.w3.org/ns/activitystreams#Note` | 📝 Notes |
| `LongChat` (Solid) | `https://www.w3.org/ns/solid/terms#LongChat` | 💬 Chat |
| `AddressBook` (vCard) | `http://www.w3.org/2006/vcard/ns#AddressBook` | 📒 Contacts |
| `Task` (noeldemartin) | `https://vocab.noeldemartin.com/tasks/Task` | ✅ Tasks |

For types not in this table the chip will show the URI fragment as a label with a 📦 icon.

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

**Hierarchical data (sub-folders):**
When your app uses grouped/nested data (e.g. collections containing items), store
each group as a sub-folder and write a metadata file (e.g. group.jsonld) inside it:
```
appRoot/
  group-slug-123/
    group.jsonld      ← group metadata (name, color, etc.)
    poi-1234.jsonld   ← item records
    poi-1234.jpg      ← related files (photos etc.)
```
To load groups, list the appRoot container and filter for isFolder === true, then
fetch the metadata file from each folder.

**Stable refs for callbacks in React:**
When passing an onClose or callback prop to a component that uses it inside a
useEffect, always store it in a ref so the effect does not re-run (and steal focus)
on every re-render:
```js
const onCloseRef = useRef(onClose);
onCloseRef.current = onClose;
useEffect(() => {
  // use onCloseRef.current() instead of onClose()
}, [isOpen]); // NOT [isOpen, onClose]
```

**appRoot inside async callbacks:**
setAppRoot(root) is async — child functions called later (e.g. loadGroups) may see
stale state. Mirror the value into a ref immediately after computing it:
```js
const appRootRef = useRef(null);
const root = p.storageRoot + 'my-app/';
setAppRoot(root);
appRootRef.current = root;   // use appRootRef.current in callbacks
```

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

---

## App configuration checklist (before packaging)

When you're ready to ship, update these files to match your app name and hosting domain.
Apps hosted on **privatedatapod.com** are served at `<appname>.apps.privatedatapod.com`.

### 1. `package.json` — app name (used in zip filename)
```json
{ "name": "geopod" }
```

### 2. `.env` — branding and domain
```env
VITE_APP_NAME=GeoPod
VITE_APP_SHORT_NAME=GeoPod
VITE_APP_DESCRIPTION=Points of Interest stored on your Solid Pod
VITE_APP_DOMAIN=geopod.apps.privatedatapod.com
VITE_SUPPORT_EMAIL=you@example.com
```

### 3. `public/client-id.json` — Solid OIDC registration
Replace every occurrence of `YOUR-APP-DOMAIN` with your real domain:
```json
{
  "client_id": "https://geopod.apps.privatedatapod.com/client-id.json",
  "client_name": "GeoPod",
  "redirect_uris": [
    "https://geopod.apps.privatedatapod.com/",
    "http://localhost:5173/"
  ],
  "logo_uri": "https://geopod.apps.privatedatapod.com/icons/pwa-192x192.png",
  "client_uri": "https://geopod.apps.privatedatapod.com/"
}
```

### 4. `capacitor.config.json` — iOS/Android (if using Capacitor)
```json
{
  "appId": "com.example.geopod",
  "appName": "GeoPod",
  "server": { "hostname": "geopod.apps.privatedatapod.com" }
}
```

Then run `.\deploy\package.ps1` to produce a deployable zip.

---

## Known dev environment issues & fixes

### PWA manifest error in dev mode
`vite-plugin-pwa` does not serve the manifest in dev by default, causing a browser
console error. Add `devOptions` to the `VitePWA()` config in `vite.config.js`:
```js
VitePWA({
  devOptions: {
    enabled: true,
    type: 'module',
  },
  // ... rest of config
})
```

### Missing PWA icons
If `public/icons/` is empty, browsers will log icon download errors. Generate
placeholder icons with this Node.js script (no extra dependencies needed):
```js
// Run with: node scripts/generate-icons.js
const fs = require('fs');
const zlib = require('zlib');

function makePng(size, r, g, b) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type);
    const crcBuf = Buffer.concat([t, data]);
    let c = 0xffffffff;
    for (const byte of crcBuf) {
      c ^= byte;
      for (let i=0;i<8;i++) c = (c&1) ? (0xedb88320^(c>>>1)) : (c>>>1);
    }
    c ^= 0xffffffff;
    const crc = Buffer.alloc(4); crc.writeUInt32BE(c >>> 0);
    return Buffer.concat([len, t, data, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4);
  ihdr[8]=8; ihdr[9]=2;
  const row = Buffer.alloc(1+size*3); row[0]=0;
  for (let x=0;x<size;x++) { row[1+x*3]=r; row[2+x*3]=g; row[3+x*3]=b; }
  const raw = Buffer.concat(Array(size).fill(row));
  return Buffer.concat([sig, chunk('IHDR',ihdr), chunk('IDAT',zlib.deflateSync(raw)), chunk('IEND',Buffer.alloc(0))]);
}

fs.mkdirSync('public/icons', { recursive: true });
[['pwa-64x64.png',64],['pwa-192x192.png',192],['pwa-512x512.png',512],
 ['maskable-icon-512x512.png',512],['apple-touch-icon.png',180]].forEach(([name,size]) => {
  fs.writeFileSync('public/icons/'+name, makePng(size, 26, 115, 232)); // #1A73E8
});
```

### Mock mode: sub-folder visibility
The mock `listContainer` in `mockStorage.js` originally only returned flat files.
If your app stores data in sub-folders (groups, collections), you must update
`listContainer` to also emit virtual folder entries for nested keys. See the
implementation in `src/utils/mockStorage.js` for the correct pattern.
