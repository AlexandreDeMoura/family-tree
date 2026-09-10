export const treeKeys = {
  all: (userId: string) => ['trees', userId] as const,
  detail: (userId: string, treeId: string) => ['trees', userId, treeId] as const,
};
