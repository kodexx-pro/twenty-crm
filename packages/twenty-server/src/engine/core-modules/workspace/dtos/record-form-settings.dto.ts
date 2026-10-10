import {
  Field,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

export enum RecordFormPresentation {
  SIDE_PANEL = 'SIDE_PANEL',
  DIALOG = 'DIALOG',
  WIZARD = 'WIZARD',
}

registerEnumType(RecordFormPresentation, { name: 'RecordFormPresentation' });

@ObjectType('RecordFormStep')
export class RecordFormStepDTO {
  @Field()
  title: string;

  @Field(() => [UUIDScalarType])
  fieldMetadataIds: string[];
}

@InputType()
export class RecordFormStepInput {
  @Field()
  @IsString()
  @MaxLength(100)
  @Matches(/\S/)
  title: string;

  @Field(() => [UUIDScalarType])
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  fieldMetadataIds: string[];
}

@ObjectType('RecordFormSettings')
export class RecordFormSettingsDTO {
  @Field(() => RecordFormPresentation, { nullable: true })
  presentation: RecordFormPresentation | null;

  @Field(() => [RecordFormStepDTO], { nullable: true })
  steps: RecordFormStepDTO[] | null;
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

  @Field(() => [RecordFormStepInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RecordFormStepInput)
  steps?: RecordFormStepInput[] | null;
}
