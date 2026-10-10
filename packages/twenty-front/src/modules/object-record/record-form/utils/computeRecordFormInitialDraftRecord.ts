import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { getFieldMetadataItemGqlFieldName } from '@/object-metadata/utils/getFieldMetadataItemGqlFieldName';
import { isManyToOneRelationField } from '@/object-metadata/utils/isManyToOneRelationField';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { isNonEmptyString, isObject } from '@sniptt/guards';
import { FieldMetadataType } from 'twenty-shared/types';
import {
  computeMorphRelationGqlFieldName,
  isDefined,
} from 'twenty-shared/utils';

export const computeRecordFormInitialDraftRecord = ({
  record,
  fieldMetadataItems,
}: {
  record: ObjectRecord;
  fieldMetadataItems: FieldMetadataItem[];
}): Partial<ObjectRecord> => {
  const draftRecord: Partial<ObjectRecord> = { ...record };
  for (const fieldMetadataItem of fieldMetadataItems) {
    if (isManyToOneRelationField(fieldMetadataItem)) {
      const gqlFieldName = getFieldMetadataItemGqlFieldName(fieldMetadataItem);
      const relationValue = record[fieldMetadataItem.name];
      if (
        !isDefined(draftRecord[gqlFieldName]) &&
        isObject(relationValue) &&
        isNonEmptyString(relationValue.id)
      )
        draftRecord[gqlFieldName] = relationValue.id;
    }
    if (fieldMetadataItem.type !== FieldMetadataType.MORPH_RELATION) continue;
    draftRecord[fieldMetadataItem.name] = null;
    for (const morphRelation of fieldMetadataItem.morphRelations ?? []) {
      const fieldName = computeMorphRelationGqlFieldName({
        fieldName: fieldMetadataItem.name,
        relationType: morphRelation.type,
        targetObjectMetadataNameSingular:
          morphRelation.targetObjectMetadata.nameSingular,
        targetObjectMetadataNamePlural:
          morphRelation.targetObjectMetadata.namePlural,
      });
      const relationValue = record[fieldName];
      const targetRecordId =
        record[`${fieldName}Id`] ??
        (isObject(relationValue) ? relationValue.id : null);
      if (!isNonEmptyString(targetRecordId)) continue;
      draftRecord[fieldMetadataItem.name] = {
        id: targetRecordId,
        targetObjectMetadataId: morphRelation.targetObjectMetadata.id,
      };
      break;
    }
  }
  return draftRecord;
};
