import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { WORKSPACE_BRANCH_OPERATIONS } from 'src/engine/core-modules/workspace-branch/workspace-branch.constants';
import { type WorkspaceBranchOperation } from 'src/engine/core-modules/workspace-branch/types/workspace-branch-access.type';

@ObjectType('WorkspaceBranch')
export class WorkspaceBranchDTO {
  @Field(() => UUIDScalarType)
  id: string;

  @Field()
  name: string;

  @Field()
  isActive: boolean;
}

@InputType()
export class WorkspaceBranchInput {
  @Field(() => UUIDScalarType)
  @IsUUID()
  id: string;

  @Field()
  @IsString()
  @MaxLength(100)
  @Matches(/\S/)
  name: string;

  @Field()
  @IsBoolean()
  isActive: boolean;
}

@ObjectType('WorkspaceBranchGrant')
export class WorkspaceBranchGrantDTO {
  @Field()
  principalType: string;

  @Field(() => UUIDScalarType)
  principalId: string;

  @Field(() => UUIDScalarType)
  branchId: string;

  @Field(() => [String])
  operations: WorkspaceBranchOperation[];
}

@InputType()
export class WorkspaceBranchGrantInput {
  @Field()
  @IsIn(['workspaceMember', 'apiKey', 'application'])
  principalType: 'workspaceMember' | 'apiKey' | 'application';

  @Field(() => UUIDScalarType)
  @IsUUID()
  principalId: string;

  @Field(() => UUIDScalarType)
  @IsUUID()
  branchId: string;

  @Field(() => [String])
  @IsArray()
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsIn(WORKSPACE_BRANCH_OPERATIONS, { each: true })
  operations: WorkspaceBranchOperation[];
}

@ObjectType('WorkspaceBranchAccess')
export class WorkspaceBranchAccessDTO {
  @Field()
  enabled: boolean;

  @Field(() => Int)
  revision: number;

  @Field(() => [WorkspaceBranchDTO])
  branches: WorkspaceBranchDTO[];

  @Field(() => [WorkspaceBranchGrantDTO])
  grants: WorkspaceBranchGrantDTO[];
}

@ObjectType('MyWorkspaceBranch')
export class MyWorkspaceBranchDTO extends WorkspaceBranchDTO {
  @Field(() => [String])
  operations: WorkspaceBranchOperation[];
}

@ObjectType('MyWorkspaceBranches')
export class MyWorkspaceBranchesDTO {
  @Field()
  enabled: boolean;

  @Field(() => Int)
  revision: number;

  @Field(() => [MyWorkspaceBranchDTO])
  branches: MyWorkspaceBranchDTO[];
}

@InputType()
export class UpdateWorkspaceBranchAccessInput {
  @Field(() => Int)
  @IsInt()
  @Min(0)
  expectedRevision: number;

  @Field()
  @IsBoolean()
  enabled: boolean;

  @Field(() => [WorkspaceBranchInput])
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => WorkspaceBranchInput)
  branches: WorkspaceBranchInput[];

  @Field(() => [WorkspaceBranchGrantInput])
  @IsArray()
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => WorkspaceBranchGrantInput)
  grants: WorkspaceBranchGrantInput[];
}
