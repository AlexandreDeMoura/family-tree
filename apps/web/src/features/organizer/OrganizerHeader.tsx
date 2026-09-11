import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth-context';

export function OrganizerHeader({ treeName, context, children }: { treeName?: string; context?: string; children?: ReactNode }) {
  const { session, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function leave() {
    setError(null);
    try {
      await signOut();
      queryClient.clear();
      navigate('/sign-in', { replace: true });
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Could not sign out.');
    }
  }

  return (
    <>
      <header className="app-header">
        <Link className="brand" to="/organizer" aria-label="Family Tree organizer home">
          <span className="brand-mark">F</span>
          <span><h1>{treeName ?? 'Family Tree'}</h1><small>{context ?? 'Organizer workspace'}</small></span>
        </Link>
        <div className="header-account">
          {children}
          {!treeName && <span>{session?.user.email}</span>}
          <button className="button button--quiet" type="button" onClick={leave}>Sign out</button>
        </div>
      </header>
      {error && <div className="global-alert" role="alert">{error}</div>}
    </>
  );
}
