import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { type Repository } from 'typeorm';

import { KeyValuePairEntity } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { type UpdateWorkspaceBranchAccessInput } from 'src/engine/core-modules/workspace-branch/dtos/workspace-branch.dto';
import { type WorkspaceBranchAccessConfiguration } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';
import { WorkspaceBranchService } from 'src/engine/core-modules/workspace-branch/workspace-branch.service';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const branchId = '22222222-2222-4222-8222-222222222222';
const memberId = '33333333-3333-4333-8333-333333333333';

const configuration = (): WorkspaceBranchAccessConfiguration => ({
  workspaceId,
  enabled: true,
  revision: 1,
  branches: [{ id: branchId, workspaceId, name: 'North', isActive: true }],
  grants: [
    {
      principal: { type: 'workspaceMember', id: memberId },
      branchId,
      operations: ['read', 'create'],
    },
  ],
});

const input = (): UpdateWorkspaceBranchAccessInput => ({
  expectedRevision: 0,
  enabled: false,
  branches: [{ id: branchId, name: ' North ', isActive: true }],
  grants: [],
});

describe('WorkspaceBranchService', () => {
  const findOne = jest.fn();
  const upsert = jest.fn();
  const query = jest.fn();
  const validator = {
    validateActivation: jest.fn(),
    validatePrincipals: jest.fn(),
  };
  const repository = {
    findOne,
    manager: {
      transaction: jest.fn(async (run) =>
        run({ query, getRepository: () => ({ findOne, upsert }) }),
      ),
    },
  } as unknown as Repository<KeyValuePairEntity>;

  beforeEach(() => {
    jest.clearAllMocks();
    findOne.mockResolvedValue(null);
    validator.validateActivation.mockResolvedValue(undefined);
    validator.validatePrincipals.mockResolvedValue(undefined);
  });

  it('preserves unrestricted behavior when no configuration exists', async () => {
    const service = new WorkspaceBranchService(repository);

    expect(await service.getConfiguration(workspaceId)).toEqual({
      workspaceId,
      enabled: false,
      revision: 0,
      branches: [],
      grants: [],
    });
    expect((await service.getMyBranches(workspaceId)).branches).toEqual([]);
  });

  it('fails closed on malformed or cross-workspace stored configuration', async () => {
    const service = new WorkspaceBranchService(repository);

    findOne.mockResolvedValue({
      value: { ...configuration(), enabled: undefined },
    });
    await expect(service.getConfiguration(workspaceId)).rejects.toThrow(
      ForbiddenException,
    );
    findOne.mockResolvedValue({
      value: { ...configuration(), workspaceId: branchId },
    });
    await expect(service.getConfiguration(workspaceId)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('loads a fresh policy for every request so revocation takes effect', async () => {
    const service = new WorkspaceBranchService(repository);

    findOne.mockResolvedValueOnce({ value: configuration() });
    findOne.mockResolvedValueOnce({
      value: { ...configuration(), grants: [] },
    });
    const principal = { type: 'workspaceMember' as const, id: memberId };

    expect(
      (await service.getMyBranches(workspaceId, principal)).branches[0]
        .operations,
    ).toEqual(['read', 'create']);
    expect(
      (await service.getMyBranches(workspaceId, principal)).branches,
    ).toEqual([]);
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('never gives implicit branch access to an unassigned actor', async () => {
    findOne.mockResolvedValue({ value: configuration() });

    expect(
      (await new WorkspaceBranchService(repository).getMyBranches(workspaceId))
        .branches,
    ).toEqual([]);
  });

  it('serializes settings edits, increments revision and keeps workspace scope server-owned', async () => {
    const result = await new WorkspaceBranchService(repository).update(
      workspaceId,
      input(),
    );

    expect(query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`workspace-branch:${workspaceId}`],
    );
    expect(result.revision).toBe(1);
    expect(result.branches[0].name).toBe('North');
    expect(upsert.mock.calls[0][0].value.branches[0].workspaceId).toBe(
      workspaceId,
    );
  });

  it('rejects stale revisions instead of overwriting another administrator', async () => {
    findOne.mockResolvedValue({ value: configuration() });

    await expect(
      new WorkspaceBranchService(repository).update(workspaceId, input()),
    ).rejects.toThrow(ConflictException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('cannot activate without a readiness validator or ignore a readiness failure', async () => {
    await expect(
      new WorkspaceBranchService(repository).update(workspaceId, {
        ...input(),
        enabled: true,
      }),
    ).rejects.toThrow('not ready for activation');
    validator.validateActivation.mockRejectedValueOnce(
      new BadRequestException('Unclassified records'),
    );
    await expect(
      new WorkspaceBranchService(repository, validator).update(workspaceId, {
        ...input(),
        enabled: true,
      }),
    ).rejects.toThrow('Unclassified records');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('validates grant tenant principals before persistence', async () => {
    validator.validatePrincipals.mockRejectedValueOnce(
      new BadRequestException('Foreign principal'),
    );
    const grants = [
      {
        principalType: 'workspaceMember' as const,
        principalId: memberId,
        branchId,
        operations: ['read' as const],
      },
    ];

    await expect(
      new WorkspaceBranchService(repository, validator).update(workspaceId, {
        ...input(),
        grants,
      }),
    ).rejects.toThrow('Foreign principal');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects a grant referencing a nonexistent branch', async () => {
    await expect(
      new WorkspaceBranchService(repository, validator).update(workspaceId, {
        ...input(),
        branches: [],
        grants: [
          {
            principalType: 'workspaceMember',
            principalId: memberId,
            branchId,
            operations: ['read'],
          },
        ],
      }),
    ).rejects.toThrow('Invalid branch grants');
    expect(upsert).not.toHaveBeenCalled();
  });
});
