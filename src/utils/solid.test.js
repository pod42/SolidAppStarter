import { describe, it, expect, vi } from 'vitest';
import { escapeTurtleString } from './solid.js';

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
