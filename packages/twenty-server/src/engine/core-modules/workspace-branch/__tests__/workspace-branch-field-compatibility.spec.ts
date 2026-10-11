import { FeatureFlagKey, FieldMetadataType } from 'twenty-shared/types';

import { type FlatApplication } from 'src/engine/core-modules/application/types/flat-application.type';
import { createEmptyFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/constant/create-empty-flat-entity-maps.constant';
import { addFlatEntityToFlatEntityMapsOrThrow } from 'src/engine/metadata-modules/flat-entity/utils/add-flat-entity-to-flat-entity-maps-or-throw.util';
import { FlatFieldMetadataTypeValidatorService } from 'src/engine/metadata-modules/flat-field-metadata/services/flat-field-metadata-type-validator.service';
import { fromCreateFieldInputToFlatFieldMetadatasToCreate } from 'src/engine/metadata-modules/flat-field-metadata/utils/from-create-field-input-to-flat-field-metadatas-to-create.util';
import { COMPANY_FLAT_OBJECT_MOCK } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/company-flat-object.mock';
import { FlatFieldMetadataValidatorService } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-builder/validators/services/flat-field-metadata-validator.service';

const applicationUniversalIdentifier = '20202020-81ee-42da-a281-668632f32fe7';

it('accepts protected branchId UUID metadata through the production transpiler and migration validator for a custom application', async () => {
  const flatObjectMetadataMaps = addFlatEntityToFlatEntityMapsOrThrow({
    flatEntity: COMPANY_FLAT_OBJECT_MOCK,
    flatEntityMaps: createEmptyFlatEntityMaps(),
  });
  const emptyFields = createEmptyFlatEntityMaps();
  const result = await fromCreateFieldInputToFlatFieldMetadatasToCreate({
    createFieldInput: {
      objectMetadataId: COMPANY_FLAT_OBJECT_MOCK.id,
      type: FieldMetadataType.UUID,
      name: 'branchId',
      label: 'Filial',
      isSystem: true,
      isNullable: true,
      isUIEditable: false,
      isUnique: false,
    },
    flatObjectMetadataMaps,
    flatFieldMetadataMaps: emptyFields,
    // The production transpiler only consumes the owner's universal identifier.
    flatApplication: {
      universalIdentifier: applicationUniversalIdentifier,
    } as FlatApplication,
  });
  expect(result.status).toBe('success');
  if (result.status !== 'success')
    throw new Error('Branch metadata transpilation failed');
  const field = result.result.flatFieldMetadatas[0];
  expect(field).toMatchObject({
    name: 'branchId',
    type: FieldMetadataType.UUID,
    isSystem: true,
    isNullable: true,
    isUIEditable: false,
    applicationUniversalIdentifier,
  });

  const validator = new FlatFieldMetadataValidatorService(
    new FlatFieldMetadataTypeValidatorService(),
  );
  const validation = validator.validateFlatFieldMetadataCreation({
    flatEntityToValidate: field,
    optimisticFlatEntityMapsAndRelatedFlatEntityMaps: {
      flatObjectMetadataMaps,
      flatFieldMetadataMaps: emptyFields,
    },
    workspaceId: COMPANY_FLAT_OBJECT_MOCK.workspaceId,
    buildOptions: { isSystemBuild: true, applicationUniversalIdentifier },
    remainingFlatEntityMapsToValidate: emptyFields,
    additionalCacheDataMaps: {
      featureFlagsMap: {
        [FeatureFlagKey.IS_APPLICATION_WORKFLOWS_ENABLED]: false,
        [FeatureFlagKey.IS_ASYNC_CSV_EXPORT_ENABLED]: false,
        [FeatureFlagKey.IS_CONFIGURABLE_SEARCH_FIELDS_ENABLED]: false,
        [FeatureFlagKey.IS_JSON_FILTER_ENABLED]: false,
        [FeatureFlagKey.IS_MESSAGE_CAMPAIGN_ENABLED]: false,
        [FeatureFlagKey.IS_REST_METADATA_API_NEW_FORMAT_DIRECT]: false,
        [FeatureFlagKey.IS_WORKFLOW_CORE_INDEX_PAGE_ENABLED]: false,
        [FeatureFlagKey.IS_AI_CHAT_SHARING_DROPDOWN_ENABLED]: false,
        [FeatureFlagKey.IS_INITIAL_OBJECT_VIEW_ENABLED]: false,
        [FeatureFlagKey.IS_DEFERRED_WORKSPACE_MIGRATION_ACTIONS_ENABLED]: false,
        [FeatureFlagKey.IS_RECORD_CREATION_FORM_ENABLED]: false,
        [FeatureFlagKey.IS_LOGS_SETTINGS_SECTION_ENABLED]: false,
        [FeatureFlagKey.IS_CONVERSATIONS_TAB_ENABLED]: false,
        [FeatureFlagKey.IS_VALIDATION_RULES_ENABLED]: false,
        [FeatureFlagKey.IS_RECORD_LEVEL_SHARING_ENABLED]: false,
        [FeatureFlagKey.IS_WORKFLOW_SEND_CHAT_MESSAGE_ENABLED]: false,
        [FeatureFlagKey.IS_CALENDAR_SYNC_SKIP_UNCHANGED_RECORDS_ENABLED]: false,
        [FeatureFlagKey.IS_RECORD_SHARE_VISIBILITY_GATING_ENABLED]: false,
        [FeatureFlagKey.IS_AI_CHAT_INBOX_ENABLED]: false,
        [FeatureFlagKey.IS_APP_PREFERENCES_ENABLED]: false,
      },
    },
  });
  expect(validation.errors).toEqual([]);
});
