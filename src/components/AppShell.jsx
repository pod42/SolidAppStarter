import { useState, useEffect } from 'react';
import { useToast } from '../hooks/useToast.js';
import ToastContainer from './Toast.jsx';
import SupportModal from './SupportModal.jsx';
import * as solidOps from '../utils/solid.js';
import * as mockOps from '../utils/mockStorage.js';

const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true';
const ops = MOCK_MODE ? mockOps : solidOps;

// ─────────────────────────────────────────────────────────────────────────────
// AppShell — authenticated app scaffold
//
// This is the ONLY file you need to replace when building your app.
// The init sequence below (fetchProfile → HEAD-check → ensureOwnInboxAppendable
// → load data) is the standard pattern for all Solid Pod apps.
//
// See PROMPT.md for the AI prompt to scaffold your feature here.
// ─────────────────────────────────────────────────────────────────────────────

export default function AppShell({ session, webId, onLogout }) {
  const { toasts, addToast, removeToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [appRoot, setAppRoot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSupport, setShowSupport] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        // 1. Load user profile → name, storageRoot, avatar
        const p = await ops.fetchProfile(webId, session.fetch);
        setProfile(p);

        // 2. Define this app's data root on the pod
        //    Change 'my-app' to a unique slug for your application
        const root = p.storageRoot + 'my-app/';
        setAppRoot(root);

        // 3. Create the app folder if it doesn't exist yet
        try {
          const r = await session.fetch(root, { method: 'HEAD' });
          if (r.status === 404) await ops.createFolder(root, session.fetch);
        } catch {
          await ops.createFolder(root, session.fetch);
        }

        // 4. Set up inbox (required before any sharing / notification features)
        await ops.ensureOwnInboxAppendable(webId, session.fetch);

        // 5. TODO: load your application data here
        //    Example:
        //      const items = await ops.listContainer(root, session.fetch);
        //      const jsonFiles = items.filter(i => !i.isFolder && i.name.endsWith('.jsonld'));
        //      const loaded = await Promise.all(jsonFiles.map(async f => {
        //        const r = await session.fetch(f.url);
        //        return r.ok ? r.json() : null;
        //      }));
        //      setItems(loaded.filter(Boolean));

      } catch (err) {
        console.error('Init error:', err);
        addToast('Could not connect to your pod. Check your connection.', 'error');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [webId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="app-loading">
        <span className="spinner-lg" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      {MOCK_MODE && (
        <div className="app-mock-banner">
          Mock mode — data stored in browser localStorage only
        </div>
      )}

      <header className="app-shell-header">
        <h1 className="app-shell-title">
          {import.meta.env.VITE_APP_NAME || 'My Solid App'}
        </h1>
        <div className="app-shell-user">
          {profile?.name && <span className="app-shell-username">{profile.name}</span>}
          <button className="btn-outline" onClick={() => setShowSupport(true)}>Support</button>
          <button className="btn-outline" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <main className="app-shell-main">
        {/* ──────────────────────────────────────────────────────────────────
            YOUR APP CONTENT GOES HERE

            Replace this placeholder block with your own components.

            Available context:
              appRoot        — pod URL for this app's data folder
              profile        — { name, storageRoot, avatar }
              session.fetch  — authenticated fetch for all pod calls
              addToast(msg, type) — show a notification ('success'|'error'|'info'|'warning')

            Solid utilities (src/utils/solid.js):
              ops.listContainer(url, session.fetch)
              ops.uploadFile(url, blob, session.fetch)
              ops.deleteResource(url, session.fetch)
              ops.setPublicRead(url, bool, session.fetch)
              ops.sendShareNotification(...) / ops.getSharedWithMe(...)

            UI primitives already wired up:
              <Modal>           — src/components/Modal.jsx
              <ToastContainer>  — already rendered below
              <SupportModal>    — already rendered below
              .btn-primary / .btn-outline / .spinner-sm  — from app.css

            See PROMPT.md to scaffold your feature with AI.
        ─────────────────────────────────────────────────────────────────── */}
        <div className="app-shell-placeholder">
          <h2>Ready to build</h2>
          <p>Your Solid Pod is connected.</p>
          <p>Pod data folder: <code>{appRoot}</code></p>
          <p>
            Open <code>src/components/AppShell.jsx</code> and replace this
            placeholder with your app&apos;s components.
          </p>
          <p>See <code>PROMPT.md</code> for the AI scaffolding prompt.</p>
        </div>
      </main>

      <SupportModal
        isOpen={showSupport}
        onClose={() => setShowSupport(false)}
        webId={webId}
        activeView="main"
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
