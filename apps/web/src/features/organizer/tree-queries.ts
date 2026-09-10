export const treeKeys = {
  all: (userId: string) => ['trees', userId] as const,
  detail: (userId: string, treeId: string) => ['trees', userId, treeId] as const,
};

export const photoKeys = {
  all: (userId: string, treeId: string) => ['photos', userId, treeId] as const,
};

export const shareKeys = {
  status: (userId: string, treeId: string) => ['share-link', userId, treeId] as const,
};
