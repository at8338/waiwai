export type OfficeSpace = { id: string; name: string; enabled: boolean };
export type SpaceMembership = { accountId: string; spaceIds: string[] };
export type SpaceSnapshot = {
  revision: number; administrator: boolean; spaces: OfficeSpace[];
  members?: { id: string; name: string; spaceIds: string[] }[];
};
export type SpaceAction = { revision: number } & (
  { type: 'create'; name: string } |
  { type: 'update'; id: string; name: string; enabled: boolean } |
  { type: 'membership'; accountId: string; spaceIds: string[] }
);
export const spaceIdValid = (id: unknown): id is string => typeof id === 'string' && /^(default|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.test(id);
