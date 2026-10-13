/* @license Enterprise */

import { Injectable } from '@nestjs/common';
import { MAX_SEATS_WITHOUT_ENTERPRISE_KEY } from 'src/engine/core-modules/enterprise/constants/max-seats-without-organization-key.constant';
import { EnterprisePlanService } from 'src/engine/core-modules/enterprise/services/enterprise-plan.service';
import { hasCustomAiProviderAccess } from 'src/engine/core-modules/enterprise/utils/has-custom-ai-provider-access.util';

export type CustomAiProviderAccess = {
  hasAccess: boolean;
  seatCount: number;
  seatThreshold: number;
};

@Injectable()
export class CustomAiProviderAccessService {
  constructor(private readonly enterprisePlanService: EnterprisePlanService) {}

  async computeAccess(): Promise<CustomAiProviderAccess> {
    const seatCount = await this.enterprisePlanService.getBillableSeatCount();
    return {
      hasAccess: hasCustomAiProviderAccess({
        isBillingEnabled: false,
        hasValidEnterprisePlan: false,
        seatCount,
      }),
      seatCount,
      seatThreshold: MAX_SEATS_WITHOUT_ENTERPRISE_KEY,
    };
  }

  getCachedHasAccess(): boolean {
    return true;
  }
}
