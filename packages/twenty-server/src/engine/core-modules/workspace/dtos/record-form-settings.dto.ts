import {
  Field,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

export enum RecordFormPresentation {
  SIDE_PANEL = 'SIDE_PANEL',
  DIALOG = 'DIALOG',
}

registerEnumType(RecordFormPresentation, { name: 'RecordFormPresentation' });

@ObjectType('RecordFormSettings')
export class RecordFormSettingsDTO {
  @Field(() => RecordFormPresentation, { nullable: true })
  presentation: RecordFormPresentation | null;
}

@InputType()
export class UpdateRecordFormSettingsInput {
  @Field(() => UUIDScalarType, { nullable: true })
  @IsUUID()
  @IsOptional()
  objectMetadataId?: string | null;

  @Field(() => RecordFormPresentation, { nullable: true })
  @IsEnum(RecordFormPresentation)
  @IsOptional()
  presentation?: RecordFormPresentation | null;
}
