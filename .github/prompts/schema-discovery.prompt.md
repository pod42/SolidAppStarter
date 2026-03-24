---
mode: agent
description: Guide Copilot to implement Solid schema discovery — reading the type index before creating containers, writing back after, and using correct RDF types on resources.
---

# Schema Discovery for Solid Apps

This app runs on **privatedatapod.com**. The platform supports schema-based app
discovery: users find apps by data type, and apps find existing user data without
hardcoded paths. Follow these patterns in every feature that reads or writes pod data.

---

## Platform schema vocabulary

Fetch the live list of known types at any time:

```
GET https://privatedatapod.com/api/schemas
```

Returns:
```json
{
  "schemas": [
    { "uri": "http://www.w3.org/2006/vcard/ns#AddressBook",  "label": "Contacts" },
    { "uri": "https://schema.org/Event",                     "label": "Calendar Events" },
    { "uri": "https://schema.org/BlogPosting",               "label": "Blog Posts" },
    { "uri": "https://schema.org/NoteDigitalDocument",       "label": "Notes" },
    { "uri": "https://schema.org/MusicPlaylist",             "label": "Music Playlists" },
    { "uri": "http://rdfs.org/sioc/ns#Post",                 "label": "Social Posts" },
    { "uri": "http://www.w3.org/ns/pim/bookmark#Bookmark",   "label": "Bookmarks" },
    { "uri": "http://www.w3.org/ns/ldp#BasicContainer",      "label": "Files" },
    { "uri": "http://www.w3.org/ns/pim/photo#PhotoAlbum",    "label": "Photos" },
    { "uri": "https://schema.org/HealthAspectEnumeration",   "label": "Health Data" },
    { "uri": "https://schema.org/Message",                   "label": "Messages" },
    { "uri": "https://schema.org/Dataset",                   "label": "Datasets" }
  ]
}
```

Use the URI constants from this list — do not invent new URIs for types that are
already covered here.

---

## Rule 1 — Check the type index before creating a container

Never assume a container path like `/contacts/` is available or correct. Always
check the user's public type index first. If an entry for the relevant schema URI
already exists, use that location.

```js
import { getSolidDataset, getThingAll, getUrl } from '@inrupt/solid-client'

const SOLID_FOR_CLASS = 'http://www.w3.org/ns/solid/terms#forClass'
const SOLID_INSTANCE  = 'http://www.w3.org/ns/solid/terms#instance'
const SOLID_INSTANCE_CONTAINER = 'http://www.w3.org/ns/solid/terms#instanceContainer'

async function findContainerForType(podRoot, typeUri, fetch) {
  const typeIndexUrl = `${podRoot}settings/publicTypeIndex.ttl`
  try {
    const ds = await getSolidDataset(typeIndexUrl, { fetch })
    const registrations = getThingAll(ds)
    for (const reg of registrations) {
      if (getUrl(reg, SOLID_FOR_CLASS) === typeUri) {
        return getUrl(reg, SOLID_INSTANCE_CONTAINER)
            || getUrl(reg, SOLID_INSTANCE)
            || null
      }
    }
  } catch { /* type index absent or inaccessible */ }
  return null
}

// Usage: only create /contacts/ if no entry exists yet
const existing = await findContainerForType(podRoot, 'http://www.w3.org/2006/vcard/ns#AddressBook', fetch)
const containerUrl = existing ?? `${podRoot}contacts/`
```

---

## Rule 2 — Write back to the type index after creating a container

Whenever your app creates a new container for typed data, register it in the
user's type index so any other Solid app can discover it.

```js
import {
  getSolidDataset, setThing, saveSolidDatasetAt,
  createThing, setUrl, buildThing
} from '@inrupt/solid-client'
import { RDF } from '@inrupt/vocab-common-rdf'

const TYPE_REGISTRATION = 'http://www.w3.org/ns/solid/terms#TypeRegistration'
const SOLID_FOR_CLASS   = 'http://www.w3.org/ns/solid/terms#forClass'
const SOLID_INSTANCE_CONTAINER = 'http://www.w3.org/ns/solid/terms#instanceContainer'

async function registerTypeIndex(podRoot, typeUri, containerUrl, fetch) {
  const typeIndexUrl = `${podRoot}settings/publicTypeIndex.ttl`
  try {
    let ds = await getSolidDataset(typeIndexUrl, { fetch })
    const reg = buildThing(createThing())
      .addUrl(RDF.type, TYPE_REGISTRATION)
      .addUrl(SOLID_FOR_CLASS, typeUri)
      .addUrl(SOLID_INSTANCE_CONTAINER, containerUrl)
      .build()
    ds = setThing(ds, reg)
    await saveSolidDatasetAt(typeIndexUrl, ds, { fetch })
  } catch (e) {
    console.warn('Could not write type index:', e)
    // Non-fatal — app still works, just not discoverable by other apps
  }
}
```

---

## Rule 3 — Tag every resource with its RDF type

Every resource your app creates must carry `rdf:type`. Without it, other apps
cannot reliably identify the records even if they find the container.

```js
import { buildThing, createThing, setThing, saveSolidDatasetAt, createSolidDataset } from '@inrupt/solid-client'
import { RDF, VCARD } from '@inrupt/vocab-common-rdf'

// Example: creating a contact
const contact = buildThing(createThing({ url: `${containerUrl}alice` }))
  .addUrl(RDF.type, VCARD.Individual)          // ← always include rdf:type
  .addStringNoLocale(VCARD.fn, 'Alice Smith')
  .addUrl(VCARD.hasEmail, 'mailto:alice@example.com')
  .build()

let ds = createSolidDataset()
ds = setThing(ds, contact)
await saveSolidDatasetAt(`${containerUrl}alice`, ds, { fetch })
```

Use the URIs from the platform schema vocabulary table — don't invent type URIs
for resources that match an existing known type.

---

## Rule 4 — Declare schemas when submitting to the App Directory

When submitting this app at `https://privatedatapod.com/apps`, select every data
type the app reads or writes. This is what makes the app discoverable to users
who filter by data type on the App Directory.

- **Over-declaring** misleads users — only tick types the app actually uses
- **Under-declaring** hides the app from relevant searches

The submission form reads the same URI vocabulary as the platform schema endpoint,
so the labels map 1:1.

---

## Rule 5 — Test cross-app interoperability

Before shipping, verify the full round-trip:

1. Use a second Solid app that supports the same schema to write sample data into
   a test pod (e.g. use a contacts app to create a contact if your app declares
   `vcard:AddressBook`)
2. Open your app — it should find and display that data without any manual setup
3. Write data with your app and verify the second app can read it back

This bidirectional test is the minimum bar for claiming schema compatibility. If
it fails, the most common causes are:
- Missing `rdf:type` on resources
- Hardcoded container path bypassing the type index lookup
- Missing type index registration after container creation

---

## What not to do

- Do not hardcode container paths as constants — always resolve from type index first
- Do not create a new container if `findContainerForType` returns a result
- Do not skip `registerTypeIndex` after creating a container
- Do not fabricate new type URIs for data that maps to an existing platform schema
- Do not declare schemas in the App Directory submission that the app doesn't actually use
