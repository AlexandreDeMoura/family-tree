import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from './auth-context';

export function SignInPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const destination = (location.state as { from?: string } | null)?.from ?? '/organizer';

  if (!loading && session) return <Navigate to="/organizer" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate(destination, { replace: true });
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="Family Tree introduction">
        <div className="auth-story__content">
          <span className="eyebrow eyebrow--light">A living family archive</span>
          <h1>Every branch holds a story worth keeping.</h1>
          <p>Build a clear, private family tree that helps relatives understand where they belong.</p>
        </div>
        <div className="branch-art" aria-hidden="true">
          <span className="branch-art__line branch-art__line--one" />
          <span className="branch-art__line branch-art__line--two" />
          <span className="branch-art__leaf branch-art__leaf--one" />
          <span className="branch-art__leaf branch-art__leaf--two" />
          <span className="branch-art__leaf branch-art__leaf--three" />
        </div>
      </section>
      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <span className="brand-mark">F</span>
          <div>
            <span className="eyebrow">Organizer access</span>
            <h2>Welcome back</h2>
            <p>Sign in with the organizer account for your family.</p>
          </div>
          {error && <div className="alert alert--error" role="alert">{error}</div>}
          <label>
            Email address
            <input
              autoComplete="email"
              inputMode="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="button button--primary button--wide" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="form-note">This private workspace is limited to the family organizer.</p>
        </form>
      </section>
    </main>
  );
}
