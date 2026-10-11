// Identities can have many branch grants. Record shares are authorization data
// whose visibility is governed by the parent record's policy.
export const shouldIsolateWorkspaceObject = (object: {
  isSystem: boolean;
  nameSingular: string;
}): boolean =>
  !['workspaceMember', 'recordShare', 'timelineActivityType', 'favorite'].includes(object.nameSingular);
