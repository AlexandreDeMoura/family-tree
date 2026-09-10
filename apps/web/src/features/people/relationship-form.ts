import {
  validateParentRelationship,
  validatePartnership,
  type FamilyGraph,
} from '@family-tree/family-core';

export type RelationshipKind = 'parent' | 'partner';

export function validateRelationshipDraft(
  graph: FamilyGraph,
  kind: RelationshipKind,
  firstId: string,
  secondId: string,
  currentYear: number,
): string | null {
  if (!firstId || !secondId) return 'Choose both people.';
  const result = kind === 'parent'
    ? validateParentRelationship(graph, { parentId: firstId, childId: secondId }, currentYear)
    : validatePartnership(graph, { person1Id: firstId, person2Id: secondId }, currentYear);
  return result.success ? null : result.issues[0]?.message ?? 'This connection is not valid.';
}
