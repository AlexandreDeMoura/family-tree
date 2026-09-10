import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, familyApi } from '../../lib/api';
import { shareKeys } from '../organizer/tree-queries';
import { buildPrivateViewerUrl } from './share-link';

export function SharePanel({ accessToken, treeId, userId }: {
  accessToken: string;
  treeId: string;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const status = useQuery({
    queryKey: shareKeys.status(userId, treeId),
    queryFn: () => familyApi.getShareLink(accessToken, treeId),
  });
  const replace = useMutation({
    mutationFn: () => familyApi.replaceShareLink(accessToken, treeId),
    onSuccess: (shareLink) => {
      queryClient.setQueryData(shareKeys.status(userId, treeId), {
        active: shareLink.active,
        createdAt: shareLink.createdAt,
      });
      setViewerUrl(buildPrivateViewerUrl(window.location.origin, treeId, shareLink.token));
      setCopied(false);
    },
  });

  function createOrReplace() {
    if (status.data?.active && !window.confirm('Replace the private link? The current link will stop working immediately.')) return;
    replace.mutate();
  }

  async function copy() {
    if (!viewerUrl) return;
    try {
      await navigator.clipboard.writeText(viewerUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="panel share-panel" aria-labelledby="share-heading">
      <div>
        <span className="eyebrow">Private sharing</span>
        <h2 id="share-heading">Invite relatives to browse</h2>
        <p>Anyone holding this unlisted link can view the family tree without an account. They cannot edit it, but they can forward the link.</p>
      </div>
      <div className="share-panel__actions">
        {status.isError && <div className="alert alert--error" role="alert">{errorMessage(status.error)}</div>}
        {replace.isError && <div className="alert alert--error" role="alert">{errorMessage(replace.error)}</div>}
        {viewerUrl && (
          <label className="share-link-field">
            <span>New private viewer link</span>
            <span className="share-link-field__row">
              <input value={viewerUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
              <button className="button button--secondary" type="button" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</button>
            </span>
            <small>Save this link now. For privacy, the server stores only its hash and cannot show it again.</small>
          </label>
        )}
        <button
          className="button button--primary"
          type="button"
          disabled={status.isPending || replace.isPending}
          onClick={createOrReplace}
        >
          {replace.isPending ? 'Creating link…' : status.data?.active ? 'Replace private link' : 'Create private link'}
        </button>
        {status.data?.active && !viewerUrl && <small className="form-note">A private link is active. Replace it if the old link was shared accidentally or you need a new copy.</small>}
      </div>
    </section>
  );
}
