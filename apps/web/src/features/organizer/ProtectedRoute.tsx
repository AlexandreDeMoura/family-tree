import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './auth-context';

export function ProtectedRoute() {
  const { session, loading, error } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageStatus title="Opening your family workspace…" />;
  if (error) return <FullPageStatus title="We couldn't restore your session" detail={error} />;
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

function FullPageStatus({ title, detail }: { title: string; detail?: string }) {
  return (
    <main className="page-center">
      <section className="status-card" role="status">
        <span className="brand-mark" aria-hidden="true">F</span>
        <h1>{title}</h1>
        {detail ? <p>{detail}</p> : <div className="loading-line" aria-hidden="true" />}
      </section>
    </main>
  );
}
