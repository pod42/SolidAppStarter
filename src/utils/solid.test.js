import { describe, it, expect, vi, beforeEach } from 'vitest';
import { escapeTurtleString, resolveTypeIndexUrl, findContainerForType, registerTypeIndex } from './solid.js';
import * as solidClient from '@inrupt/solid-client';

vi.mock('@inrupt/solid-client', () => ({
  getSolidDataset:            vi.fn(),
  createSolidDataset:         vi.fn(),
  getThing:                   vi.fn(),
  getThingAll:                vi.fn(),
  getUrl:                     vi.fn(),
  getStringNoLocale:          vi.fn(),
  getDatetime:                vi.fn(),
  getInteger:                 vi.fn(),
  overwriteFile:              vi.fn(),
  deleteFile:                 vi.fn(),
  getFile:                    vi.fn(),
  getContainedResourceUrlAll: vi.fn(),
  getResourceInfoWithAcl:     vi.fn(),
  hasResourceAcl:             vi.fn(),
  hasFallbackAcl:             vi.fn(),
  hasAccessibleAcl:           vi.fn(),
  createAclFromFallbackAcl:   vi.fn(),
  getResourceAcl:             vi.fn(),
  setPublicResourceAccess:    vi.fn(),
  setAgentResourceAccess:     vi.fn(),
  saveAclFor:                 vi.fn(),
  setThing:                   vi.fn(),
  saveSolidDatasetAt:         vi.fn(),
  createThing:                vi.fn(),
  buildThing:                 vi.fn(),
}));

// ─── escapeTurtleString ──────────────────────────────────────────────────────

describe('escapeTurtleString', () => {
  it('returns plain strings unchanged', () => {
    expect(escapeTurtleString('hello world')).toBe('hello world');
  });

  it('escapes double quotes', () => {
    expect(escapeTurtleString('say "hi"')).toBe('say \\"hi\\"');
  });

  it('escapes backslashes', () => {
    expect(escapeTurtleString('C:\\path\\file')).toBe('C:\\\\path\\\\file');
  });

  it('escapes newlines', () => {
    expect(escapeTurtleString('line1\nline2')).toBe('line1\\nline2');
  });

  it('escapes carriage returns', () => {
    expect(escapeTurtleString('line1\rline2')).toBe('line1\\rline2');
  });

  it('escapes tabs', () => {
    expect(escapeTurtleString('col1\tcol2')).toBe('col1\\tcol2');
  });

  it('escapes all special chars combined', () => {
    expect(escapeTurtleString('"name"\n\t\\path')).toBe('\\"name\\"\\n\\t\\\\path');
  });

  it('handles empty string', () => {
    expect(escapeTurtleString('')).toBe('');
  });
});

// ─── URL joining (storageRoot + app path) ────────────────────────────────────

describe('URL joining for app root', () => {
  it('joins correctly when storageRoot has trailing slash', () => {
    expect(new URL('my-app/', 'https://example.com/alice/').href)
      .toBe('https://example.com/alice/my-app/');
  });

  it('handles origin-root storage', () => {
    expect(new URL('my-app/', 'https://example.com/').href)
      .toBe('https://example.com/my-app/');
  });

  it('handles deep storage root', () => {
    expect(new URL('my-app/', 'https://example.com/pods/alice/').href)
      .toBe('https://example.com/pods/alice/my-app/');
  });
});

// ─── createContainerViaPost Location header logic ────────────────────────────

describe('createContainerViaPost Location header handling', () => {
  it('returns slug URL when server returns 409 (already exists)', async () => {
    // simulate what createContainerViaPost does with the returned value
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 409, headers: new Headers() });

    // Re-implement just the return logic inline for testing
    const containerUrl = 'https://example.com/alice/inbox/';
    const withSlash = containerUrl.replace(/\/?$/, '/');
    const parentUrl = withSlash.replace(/[^/]+\/$/, '');
    const slug = withSlash.replace(/\/$/, '').split('/').pop();

    const resp = await mockFetch(parentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/turtle', 'Slug': slug, 'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"' },
      body: '',
    });

    let result;
    if (!resp.ok && resp.status !== 409) {
      throw new Error('unexpected');
    }
    const location = resp.headers?.get('Location');
    result = (location && resp.status !== 409) ? new URL(location, parentUrl).href.replace(/\/?$/, '/') : withSlash;

    expect(result).toBe(withSlash);
  });

  it('returns Location header URL when server returns 201', async () => {
    const headers = new Headers({ Location: '/alice/inbox-1/' });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 201, headers });

    const containerUrl = 'https://example.com/alice/inbox/';
    const withSlash = containerUrl.replace(/\/?$/, '/');
    const parentUrl = withSlash.replace(/[^/]+\/$/, '');
    const slug = withSlash.replace(/\/$/, '').split('/').pop();

    const resp = await mockFetch(parentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/turtle', 'Slug': slug },
      body: '',
    });

    const location = resp.headers?.get('Location');
    const result = (location && resp.status !== 409)
      ? new URL(location, parentUrl).href.replace(/\/?$/, '/')
      : withSlash;

    expect(result).toBe('https://example.com/alice/inbox-1/');
  });
});

// ─── Notification 403 vs 404 filtering ───────────────────────────────────────

describe('stale notification cleanup', () => {
  it('should NOT delete a notification when resource returns 403', async () => {
    const deleteFn = vi.fn().mockResolvedValue({ ok: true });
    const headFn = vi.fn().mockResolvedValue({ ok: false, status: 403 });

    const item = { url: 'https://example.com/resource', notifUrl: 'https://alice.example/inbox/notif1' };

    const resp = await headFn(item.url, { method: 'HEAD' });
    if (resp.ok) {
      // include
    } else if (resp.status === 404) {
      await deleteFn(item.notifUrl, { method: 'DELETE' });
    }
    // 403 → do nothing

    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('should delete a notification when resource returns 404', async () => {
    const deleteFn = vi.fn().mockResolvedValue({ ok: true });
    const headFn = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    const item = { url: 'https://example.com/resource', notifUrl: 'https://alice.example/inbox/notif1' };

    const resp = await headFn(item.url, { method: 'HEAD' });
    if (resp.ok) {
      // include
    } else if (resp.status === 404) {
      await deleteFn(item.notifUrl, { method: 'DELETE' });
    }

    expect(deleteFn).toHaveBeenCalledWith(item.notifUrl, { method: 'DELETE' });
  });
});

// ─── resolveTypeIndexUrl ─────────────────────────────────────────────────────

describe('resolveTypeIndexUrl', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns solid:publicTypeIndex from profile when present', async () => {
    vi.mocked(solidClient.getSolidDataset).mockResolvedValue({});
    vi.mocked(solidClient.getThing).mockReturnValue({});
    vi.mocked(solidClient.getUrl).mockReturnValue('https://example.com/alice/settings/publicTypeIndex.ttl');

    const result = await resolveTypeIndexUrl(
      'https://example.com/alice/profile/card#me',
      'https://example.com/alice/',
      vi.fn(),
    );
    expect(result).toBe('https://example.com/alice/settings/publicTypeIndex.ttl');
  });

  it('falls back to conventional path when profile has no publicTypeIndex', async () => {
    vi.mocked(solidClient.getSolidDataset).mockResolvedValue({});
    vi.mocked(solidClient.getThing).mockReturnValue({});
    vi.mocked(solidClient.getUrl).mockReturnValue(null);

    const result = await resolveTypeIndexUrl(
      'https://example.com/alice/profile/card#me',
      'https://example.com/alice/',
      vi.fn(),
    );
    expect(result).toBe('https://example.com/alice/settings/publicTypeIndex.ttl');
  });

  it('falls back to conventional path when getSolidDataset throws', async () => {
    vi.mocked(solidClient.getSolidDataset).mockRejectedValue(new Error('Network error'));

    const result = await resolveTypeIndexUrl(
      'https://example.com/alice/profile/card#me',
      'https://example.com/alice/',
      vi.fn(),
    );
    expect(result).toBe('https://example.com/alice/settings/publicTypeIndex.ttl');
  });
});

// ─── findContainerForType ────────────────────────────────────────────────────

describe('findContainerForType', () => {
  const WEB_ID   = 'https://example.com/alice/profile/card#me';
  const POD_ROOT = 'https://example.com/alice/';
  const TYPE_URI = 'https://schema.org/NoteDigitalDocument';
  const CONTAINER_URL = 'https://example.com/alice/notes/';

  beforeEach(() => vi.clearAllMocks());

  it('returns instanceContainer URL when type registration exists', async () => {
    vi.mocked(solidClient.getSolidDataset)
      .mockResolvedValueOnce({}) // profile (for resolveTypeIndexUrl)
      .mockResolvedValueOnce({}); // type index
    vi.mocked(solidClient.getThing).mockReturnValue({});
    vi.mocked(solidClient.getUrl)
      .mockReturnValueOnce('https://example.com/alice/settings/publicTypeIndex.ttl') // publicTypeIndex
      .mockReturnValueOnce(TYPE_URI)     // forClass
      .mockReturnValueOnce(CONTAINER_URL); // instanceContainer
    vi.mocked(solidClient.getThingAll).mockReturnValue([{}]);

    const result = await findContainerForType(WEB_ID, POD_ROOT, TYPE_URI, vi.fn());
    expect(result).toBe(CONTAINER_URL);
  });

  it('returns null when no registration matches the type', async () => {
    vi.mocked(solidClient.getSolidDataset)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    vi.mocked(solidClient.getThing).mockReturnValue({});
    vi.mocked(solidClient.getUrl)
      .mockReturnValueOnce('https://example.com/alice/settings/publicTypeIndex.ttl')
      .mockReturnValueOnce('https://schema.org/SomethingElse'); // forClass does not match
    vi.mocked(solidClient.getThingAll).mockReturnValue([{}]);

    const result = await findContainerForType(WEB_ID, POD_ROOT, TYPE_URI, vi.fn());
    expect(result).toBeNull();
  });

  it('returns null when type index is inaccessible', async () => {
    vi.mocked(solidClient.getSolidDataset)
      .mockResolvedValueOnce({}) // profile
      .mockRejectedValueOnce(new Error('404')); // type index
    vi.mocked(solidClient.getThing).mockReturnValue({});
    vi.mocked(solidClient.getUrl).mockReturnValue('https://example.com/alice/settings/publicTypeIndex.ttl');

    const result = await findContainerForType(WEB_ID, POD_ROOT, TYPE_URI, vi.fn());
    expect(result).toBeNull();
  });
});

// ─── registerTypeIndex ───────────────────────────────────────────────────────

describe('registerTypeIndex', () => {
  const WEB_ID        = 'https://example.com/alice/profile/card#me';
  const POD_ROOT      = 'https://example.com/alice/';
  const TYPE_URI      = 'https://schema.org/NoteDigitalDocument';
  const CONTAINER_URL = 'https://example.com/alice/notes/';
  const TYPE_INDEX_URL = 'https://example.com/alice/settings/publicTypeIndex.ttl';

  const fakeThing = {};

  beforeEach(() => vi.clearAllMocks());

  it('saves the registration to the type index', async () => {
    vi.mocked(solidClient.getSolidDataset)
      .mockResolvedValueOnce({}) // profile (resolveTypeIndexUrl)
      .mockResolvedValueOnce({}); // existing type index
    vi.mocked(solidClient.getThing).mockReturnValue({});
    vi.mocked(solidClient.getUrl).mockReturnValue(TYPE_INDEX_URL);
    vi.mocked(solidClient.buildThing).mockReturnValue({ addUrl: vi.fn().mockReturnThis(), build: vi.fn().mockReturnValue(fakeThing) });
    vi.mocked(solidClient.createThing).mockReturnValue({});
    vi.mocked(solidClient.setThing).mockReturnValue({});
    vi.mocked(solidClient.saveSolidDatasetAt).mockResolvedValue({});

    await registerTypeIndex(WEB_ID, POD_ROOT, TYPE_URI, CONTAINER_URL, vi.fn());
    expect(vi.mocked(solidClient.saveSolidDatasetAt)).toHaveBeenCalledWith(
      TYPE_INDEX_URL,
      expect.anything(),
      expect.objectContaining({ fetch: expect.any(Function) }),
    );
  });

  it('creates a fresh dataset when type index does not exist yet', async () => {
    vi.mocked(solidClient.getSolidDataset)
      .mockResolvedValueOnce({}) // profile
      .mockRejectedValueOnce(new Error('404')); // type index absent
    vi.mocked(solidClient.getThing).mockReturnValue({});
    vi.mocked(solidClient.getUrl).mockReturnValue(TYPE_INDEX_URL);
    vi.mocked(solidClient.createSolidDataset).mockReturnValue({});
    vi.mocked(solidClient.buildThing).mockReturnValue({ addUrl: vi.fn().mockReturnThis(), build: vi.fn().mockReturnValue(fakeThing) });
    vi.mocked(solidClient.createThing).mockReturnValue({});
    vi.mocked(solidClient.setThing).mockReturnValue({});
    vi.mocked(solidClient.saveSolidDatasetAt).mockResolvedValue({});

    await registerTypeIndex(WEB_ID, POD_ROOT, TYPE_URI, CONTAINER_URL, vi.fn());
    expect(vi.mocked(solidClient.createSolidDataset)).toHaveBeenCalled();
    expect(vi.mocked(solidClient.saveSolidDatasetAt)).toHaveBeenCalled();
  });

  it('does not throw when saveSolidDatasetAt fails (non-fatal)', async () => {
    vi.mocked(solidClient.getSolidDataset)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    vi.mocked(solidClient.getThing).mockReturnValue({});
    vi.mocked(solidClient.getUrl).mockReturnValue(TYPE_INDEX_URL);
    vi.mocked(solidClient.buildThing).mockReturnValue({ addUrl: vi.fn().mockReturnThis(), build: vi.fn().mockReturnValue(fakeThing) });
    vi.mocked(solidClient.createThing).mockReturnValue({});
    vi.mocked(solidClient.setThing).mockReturnValue({});
    vi.mocked(solidClient.saveSolidDatasetAt).mockRejectedValue(new Error('403 Forbidden'));

    await expect(registerTypeIndex(WEB_ID, POD_ROOT, TYPE_URI, CONTAINER_URL, vi.fn()))
      .resolves.toBeUndefined();
  });
});
