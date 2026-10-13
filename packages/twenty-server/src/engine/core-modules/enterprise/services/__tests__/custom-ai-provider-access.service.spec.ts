import { CustomAiProviderAccessService } from 'src/engine/core-modules/enterprise/services/custom-ai-provider-access.service';
import { type EnterprisePlanService } from 'src/engine/core-modules/enterprise/services/enterprise-plan.service';

describe('custom AI providers in the fork', () => {
  const plan = { getBillableSeatCount: jest.fn(), isValid: jest.fn() };
  const service = new CustomAiProviderAccessService(
    plan as unknown as EnterprisePlanService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('allows providers for a large instance without checking a license', async () => {
    plan.getBillableSeatCount.mockResolvedValue(10_000);
    expect(await service.computeAccess()).toMatchObject({
      hasAccess: true,
      seatCount: 10_000,
    });
    expect(plan.isValid).not.toHaveBeenCalled();
  });

  it('does not depend on seat counting on the inference path', () => {
    expect(service.getCachedHasAccess()).toBe(true);
    expect(plan.getBillableSeatCount).not.toHaveBeenCalled();
    expect(plan.isValid).not.toHaveBeenCalled();
  });
});
