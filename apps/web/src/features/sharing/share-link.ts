const shareTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function buildPrivateViewerUrl(origin: string, treeId: string, token: string) {
  return `${origin}/view/${encodeURIComponent(treeId)}#${token}`;
}

export function buildPrivateViewerPath(treeId: string, token: string, personId?: string) {
  const person = personId ? `?person=${encodeURIComponent(personId)}` : '';
  return `/view/${encodeURIComponent(treeId)}${person}#${token}`;
}

export function buildPrivatePhotoViewerPath(
  treeId: string,
  personId: string,
  token: string,
  ageBucket?: string,
  photoId?: string,
) {
  const parameters = new URLSearchParams();
  if (ageBucket) parameters.set('bucket', ageBucket);
  if (photoId) parameters.set('photo', photoId);
  const search = parameters.size ? `?${parameters.toString()}` : '';
  return `/view/${encodeURIComponent(treeId)}/people/${encodeURIComponent(personId)}/photos${search}#${token}`;
}

export function readPrivateViewerToken(fragment: string) {
  const token = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  return shareTokenPattern.test(token) ? token : null;
}
