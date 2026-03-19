import { useAuth } from './hooks/useAuth.js';
import LoginScreen from './components/LoginScreen.jsx';
import AppShell from './components/AppShell.jsx';
import './app.css';

function App() {
  const { session, isLoggedIn, webId, loading, login, logout } = useAuth();

  if (loading) {
    return (
      <div className="app-loading">
        <span className="spinner-lg" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <AppShell
      session={session}
      webId={webId}
      onLogout={logout}
    />
  );
}

export default App;
