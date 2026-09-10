import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { errorMessage, familyApi } from '../../lib/api';
import { useAuth } from './auth-context';
import { OrganizerHeader } from './OrganizerHeader';
import { treeKeys } from './tree-queries';

export function OrganizerHomePage() {
  const { session } = useAuth();
  const accessToken = session!.access_token;
  const userId = session!.user.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const trees = useQuery({
    queryKey: treeKeys.all(userId),
    queryFn: () => familyApi.listTrees(accessToken),
  });
  const createTree = useMutation({
    mutationFn: () => familyApi.createTree(accessToken, name.trim()),
    onSuccess: async (tree) => {
      await queryClient.invalidateQueries({ queryKey: treeKeys.all(userId) });
      navigate(`/organizer/trees/${tree.id}`);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    createTree.mutate();
  }

  return (
    <div className="app-shell">
      <OrganizerHeader />
      <main className="workspace home-workspace">
        <section className="welcome-block">
          <span className="eyebrow">Your family archive</span>
          <h1>Families are built one story at a time.</h1>
          <p>Choose a tree to continue editing, or begin a new family record.</p>
        </section>

        {trees.isPending && <PagePanelStatus title="Gathering your family trees…" />}
        {trees.isError && (
          <PagePanelStatus
            title="We couldn't load your family trees"
            detail={errorMessage(trees.error)}
            action={<button className="button button--secondary" type="button" onClick={() => void trees.refetch()}>Try again</button>}
          />
        )}
        {trees.data && trees.data.length > 0 && (
          <section className="tree-list" aria-label="Your family trees">
            {trees.data.map((tree) => (
              <Link className="tree-card" key={tree.id} to={`/organizer/trees/${tree.id}`}>
                <span className="tree-card__monogram">{tree.name.charAt(0).toUpperCase()}</span>
                <span><strong>{tree.name}</strong><small>{new Date(tree.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</small></span>
                <span className="tree-card__arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </section>
        )}

        {trees.data && trees.data.length === 0 && (
          <section className="empty-hero">
            <span className="empty-hero__mark" aria-hidden="true">✦</span>
            <h2>Start with your family name</h2>
            <p>Your first tree begins empty. Add one person, then connect each new branch as the story grows.</p>
          </section>
        )}

        {trees.data && (
          <section className="panel create-tree-panel">
            <div>
              <span className="eyebrow">{trees.data.length ? 'Another tree' : 'First step'}</span>
              <h2>{trees.data.length ? 'Create a family tree' : 'Name your family tree'}</h2>
              <p>You can use a surname, family branch, or any name your relatives will recognize.</p>
            </div>
            <form onSubmit={submit}>
              <label>
                Tree name
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="The Martin Family" required />
              </label>
              {createTree.isError && <div className="alert alert--error" role="alert">{errorMessage(createTree.error)}</div>}
              <button className="button button--primary" type="submit" disabled={!name.trim() || createTree.isPending}>
                {createTree.isPending ? 'Creating…' : 'Create tree'}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}

function PagePanelStatus({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return <section className="panel page-status" role="status"><div className="loading-orb" /><h2>{title}</h2>{detail && <p>{detail}</p>}{action}</section>;
}
