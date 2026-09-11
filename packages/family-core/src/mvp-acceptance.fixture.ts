import type { FamilyGraph, Partnership, Person } from './schemas.js';

export const mvpAcceptanceIds = {
  elise: 'elise',
  henri: 'henri',
  luc: 'luc',
  claire: 'claire',
  nadia: 'nadia',
  anne: 'anne',
  pierre: 'pierre',
  marc: 'marc',
  celine: 'celine',
  rene: 'rene',
  louise: 'louise',
  paul: 'paul',
  ines: 'ines',
  hugo: 'hugo',
  emma: 'emma',
  theo: 'theo',
  sofia: 'sofia',
  jules: 'jules',
  mia: 'mia',
  isolated: 'isolated',
} as const;

export const mvpAcceptanceLargeSiblingIds = [
  mvpAcceptanceIds.anne,
  mvpAcceptanceIds.pierre,
  mvpAcceptanceIds.marc,
  mvpAcceptanceIds.celine,
  mvpAcceptanceIds.rene,
  mvpAcceptanceIds.louise,
  mvpAcceptanceIds.paul,
  mvpAcceptanceIds.ines,
  mvpAcceptanceIds.hugo,
  mvpAcceptanceIds.emma,
] as const;

const fixtureTreeId = 'mvp-manual-acceptance';

function partnership(person1Id: string, person2Id: string): Partnership {
  return person1Id < person2Id ? { person1Id, person2Id } : { person1Id: person2Id, person2Id: person1Id };
}

/**
 * A deliberately synthetic, privacy-safe graph shared by automated layout/card
 * checks and the local manual-acceptance seed. It has no photos so the real
 * signed upload and age-bucket workflow can be exercised during acceptance.
 */
export function createMvpAcceptanceGraph(treeId = fixtureTreeId): FamilyGraph {
  const person = (
    id: string,
    firstName: string,
    overrides: Partial<Omit<Person, 'id' | 'treeId' | 'firstName'>> = {},
  ): Person => ({
    id,
    treeId,
    firstName,
    lastName: 'Moreau',
    lifeStatus: 'living',
    birthYear: null,
    deathYear: null,
    adopted: false,
    mainPhotoId: null,
    funFacts: [],
    parentsComplete: false,
    partnersComplete: false,
    childrenComplete: false,
    ...overrides,
  });

  const people = [
    person(mvpAcceptanceIds.elise, 'Elise', {
      lifeStatus: 'deceased', birthYear: 1915, deathYear: 2007,
      funFacts: ['Kept a garden full of lavender'], parentsComplete: true,
      partnersComplete: true, childrenComplete: true,
    }),
    person(mvpAcceptanceIds.henri, 'Henri', {
      lifeStatus: 'deceased', birthYear: 1912, deathYear: 1998,
      parentsComplete: true, partnersComplete: true, childrenComplete: true,
    }),
    person(mvpAcceptanceIds.luc, 'Luc', {
      lifeStatus: 'deceased', birthYear: 1940, deathYear: 2020,
      funFacts: ['Could play accordion by ear'], parentsComplete: true,
      partnersComplete: true, childrenComplete: true,
    }),
    person(mvpAcceptanceIds.claire, 'Claire', {
      lifeStatus: 'unknown', birthYear: 1942,
      funFacts: ['Owned a bakery in Lyon'], partnersComplete: true, childrenComplete: true,
    }),
    person(mvpAcceptanceIds.nadia, 'Nadia', {
      birthYear: 1950, partnersComplete: true, childrenComplete: true,
    }),
    person(mvpAcceptanceIds.anne, 'Anne', {
      birthYear: 1964, parentsComplete: true, partnersComplete: true,
      childrenComplete: true, funFacts: ['Organizes the annual family picnic'],
    }),
    person(mvpAcceptanceIds.pierre, 'Pierre', {
      lifeStatus: 'deceased', birthYear: 1966, deathYear: null, parentsComplete: true,
    }),
    person(mvpAcceptanceIds.marc, 'Marc', {
      lifeStatus: 'unknown', birthYear: 1968, adopted: true, parentsComplete: true,
      funFacts: ['Restores old bicycles'],
    }),
    person(mvpAcceptanceIds.celine, 'Celine', { birthYear: 1970, parentsComplete: true }),
    person(mvpAcceptanceIds.rene, 'Rene', { birthYear: 1972, parentsComplete: true }),
    person(mvpAcceptanceIds.louise, 'Louise', { birthYear: 1974, parentsComplete: true }),
    person(mvpAcceptanceIds.paul, 'Paul', { birthYear: 1976, parentsComplete: true }),
    person(mvpAcceptanceIds.ines, 'Ines', { birthYear: 1978, parentsComplete: true }),
    person(mvpAcceptanceIds.hugo, 'Hugo', { birthYear: 1980, parentsComplete: true }),
    person(mvpAcceptanceIds.emma, 'Emma', { birthYear: 1982, parentsComplete: true }),
    person(mvpAcceptanceIds.theo, 'Theo', {
      birthYear: 1986, parentsComplete: true, partnersComplete: true, childrenComplete: true,
    }),
    person(mvpAcceptanceIds.sofia, 'Sofia', {
      birthYear: 1965, partnersComplete: true, childrenComplete: true,
    }),
    person(mvpAcceptanceIds.jules, 'Jules', {
      birthYear: 1994, parentsComplete: true, partnersComplete: true, childrenComplete: true,
    }),
    person(mvpAcceptanceIds.mia, 'Mia', {
      lifeStatus: 'unknown', birthYear: null,
      funFacts: ['Birth year and one parent are intentionally unknown'],
    }),
    person(mvpAcceptanceIds.isolated, 'Sam', {
      lastName: 'Rivera', lifeStatus: 'unknown', birthYear: null,
      funFacts: ['An intentionally disconnected relative'],
      partnersComplete: true, childrenComplete: true,
    }),
  ];

  const parentChild = [
    [mvpAcceptanceIds.elise, mvpAcceptanceIds.luc],
    [mvpAcceptanceIds.henri, mvpAcceptanceIds.luc],
    ...mvpAcceptanceLargeSiblingIds.flatMap((childId) => [
      [mvpAcceptanceIds.luc, childId],
      [mvpAcceptanceIds.claire, childId],
    ]),
    [mvpAcceptanceIds.luc, mvpAcceptanceIds.theo],
    [mvpAcceptanceIds.nadia, mvpAcceptanceIds.theo],
    [mvpAcceptanceIds.anne, mvpAcceptanceIds.jules],
    [mvpAcceptanceIds.sofia, mvpAcceptanceIds.jules],
    [mvpAcceptanceIds.anne, mvpAcceptanceIds.mia],
  ].map(([parentId, childId]) => ({ parentId, childId }));

  const partnerships = [
    partnership(mvpAcceptanceIds.elise, mvpAcceptanceIds.henri),
    partnership(mvpAcceptanceIds.luc, mvpAcceptanceIds.claire),
    partnership(mvpAcceptanceIds.luc, mvpAcceptanceIds.nadia),
    partnership(mvpAcceptanceIds.anne, mvpAcceptanceIds.sofia),
  ];

  return { treeId, people, parentChild, partnerships };
}
