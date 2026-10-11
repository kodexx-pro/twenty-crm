import { ForbiddenException } from '@nestjs/common';
import { type WorkspaceBranchAccess } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';
import { assertWorkspaceBranchWrite } from 'src/engine/core-modules/workspace-branch/utils/assert-workspace-branch-write.util';
import {
  buildWorkspaceBranchRecordFilter,
  intersectWorkspaceBranchRecordFilter,
} from 'src/engine/core-modules/workspace-branch/utils/build-workspace-branch-record-filter.util';

describe('branch record boundaries', () => {
  const allowed: WorkspaceBranchAccess = {
    kind: 'restricted',
    branchIds: ['north', 'south'],
  };
  const denied: WorkspaceBranchAccess = { kind: 'restricted', branchIds: [] };

  it('does not add a predicate when the feature is disabled', () => {
    expect(
      buildWorkspaceBranchRecordFilter({
        branchAccess: { kind: 'unrestricted' },
        branchFieldName: 'branchId',
      }),
    ).toBeNull();
  });

  it('does not turn an empty permission set into unrestricted access', () => {
    expect(
      buildWorkspaceBranchRecordFilter({
        branchAccess: denied,
        branchFieldName: 'branchId',
      }),
    ).toEqual({ id: { is: 'NULL' } });
  });

  it('intersects branch access even with a role filter containing an OR', () => {
    const recordFilter = {
      or: [{ name: { eq: 'Example' } }, { name: { eq: 'Other' } }],
    };
    const branchFilter = buildWorkspaceBranchRecordFilter({
      branchAccess: allowed,
      branchFieldName: 'branchId',
    });
    expect(
      intersectWorkspaceBranchRecordFilter({ recordFilter, branchFilter }),
    ).toEqual({
      and: [recordFilter, { branchId: { in: ['north', 'south'] } }],
    });
    expect(
      intersectWorkspaceBranchRecordFilter({
        recordFilter,
        branchFilter: null,
      }),
    ).toBe(recordFilter);
  });

  it.each([null, undefined, '', 'other'])(
    'rejects an invalid branch on creation: %s',
    (branchIdAfter) => {
      expect(() =>
        assertWorkspaceBranchWrite({
          operationAccess: allowed,
          branchIdAfter,
          isCreation: true,
        }),
      ).toThrow(ForbiddenException);
    },
  );

  it('accepts creation and an unchanged branch where access is granted', () => {
    expect(() =>
      assertWorkspaceBranchWrite({
        operationAccess: allowed,
        branchIdAfter: 'north',
        isCreation: true,
      }),
    ).not.toThrow();
    expect(() =>
      assertWorkspaceBranchWrite({
        operationAccess: allowed,
        branchIdBefore: 'north',
        branchIdAfter: 'north',
        isCreation: false,
      }),
    ).not.toThrow();
  });

  it('cannot move a record out of a branch the actor cannot update', () => {
    expect(() =>
      assertWorkspaceBranchWrite({
        operationAccess: allowed,
        branchIdBefore: 'other',
        branchIdAfter: 'north',
        isCreation: false,
        transferAccess: allowed,
        destinationCreationAccess: allowed,
      }),
    ).toThrow(ForbiddenException);
  });

  it('requires transfer rights even if both branches can be operated', () => {
    expect(() =>
      assertWorkspaceBranchWrite({
        operationAccess: allowed,
        branchIdBefore: 'north',
        branchIdAfter: 'south',
        isCreation: false,
      }),
    ).toThrow(ForbiddenException);
  });

  it('requires create access at the destination as well as transfer rights', () => {
    expect(() =>
      assertWorkspaceBranchWrite({
        operationAccess: allowed,
        branchIdBefore: 'north',
        branchIdAfter: 'south',
        isCreation: false,
        transferAccess: allowed,
        destinationCreationAccess: denied,
      }),
    ).toThrow(ForbiddenException);
  });

  it('accepts an explicitly authorized transfer', () => {
    expect(() =>
      assertWorkspaceBranchWrite({
        operationAccess: allowed,
        branchIdBefore: 'north',
        branchIdAfter: 'south',
        isCreation: false,
        transferAccess: allowed,
        destinationCreationAccess: allowed,
      }),
    ).not.toThrow();
  });

  it('preserves writes without a branch when isolation is disabled', () => {
    expect(() =>
      assertWorkspaceBranchWrite({
        operationAccess: { kind: 'unrestricted' },
        branchIdAfter: null,
        isCreation: true,
      }),
    ).not.toThrow();
  });
});
