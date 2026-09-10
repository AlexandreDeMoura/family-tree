const shareTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function buildPrivateViewerUrl(origin: string, treeId: string, token: string) {
  return `${origin}/view/${encodeURIComponent(treeId)}#${token}`;
}

export function readPrivateViewerToken(fragment: string) {
  const token = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  return shareTokenPattern.test(token) ? token : null;
}

