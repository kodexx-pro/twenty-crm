import { type WorkspaceBranchAccessConfiguration } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';
import { resolveWorkspaceBranchMemberAccess } from 'src/engine/core-modules/workspace-branch/utils/resolve-workspace-branch-member-access.util';
import { shouldIsolateWorkspaceObject } from 'src/engine/core-modules/workspace-branch/utils/should-isolate-workspace-object.util';

const configuration: WorkspaceBranchAccessConfiguration = {
  workspaceId: 'workspace', enabled: true, revision: 1,
  branches: ['north','south'].map(id => ({id,workspaceId:'workspace',name:id,isActive:true})),
  grants: [
    {principal: {type:'workspaceMember',id:'me'},branchId:'north',operations:['read']},
    {principal: {type:'workspaceMember',id:'colleague'},branchId:'north',operations:['create']},
    {principal: {type:'workspaceMember',id:'other'},branchId:'south',operations:['read']},
    {principal: {type:'apiKey',id:'automation'},branchId:'north',operations:['read']},
  ],
};

describe('branch member directory', () => {
  it('includes self and colleagues from permitted branches only', () => {
    expect(resolveWorkspaceBranchMemberAccess({configuration,workspaceId:'workspace',principal:{type:'workspaceMember',id:'me'}})).toEqual({kind:'restricted',branchIds:['me','colleague'],fieldName:'id'});
  });
  it('does not widen an unauthorized branch selection', () => {
    expect(resolveWorkspaceBranchMemberAccess({configuration,workspaceId:'workspace',principal:{type:'workspaceMember',id:'me'},selectedBranchId:'south'})).toEqual({kind:'restricted',branchIds:['me'],fieldName:'id'});
  });
  it('does not leak identities across workspace boundaries', () => {
    expect(resolveWorkspaceBranchMemberAccess({configuration,workspaceId:'different',principal:{type:'workspaceMember',id:'me'}})).toEqual({kind:'restricted',branchIds:[],fieldName:'id'});
  });
  it('retains the existing directory when disabled', () => {
    expect(resolveWorkspaceBranchMemberAccess({configuration:{...configuration,enabled:false},workspaceId:'workspace'})).toEqual({kind:'unrestricted'});
  });
});

describe('workspace branch business classification', () => {
  it.each(['company','person','attachment','noteTarget','taskTarget','message','calendarEvent','timelineActivity','workflowRun','agentChatThread'])('isolates %s even if marked system', nameSingular => {
    expect(shouldIsolateWorkspaceObject({nameSingular,isSystem:true})).toBe(true);
  });
  it.each(['workspaceMember','recordShare'])('keeps %s under its dedicated authorization', nameSingular => {
    expect(shouldIsolateWorkspaceObject({nameSingular,isSystem:true})).toBe(false);
  });
});
