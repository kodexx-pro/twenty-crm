import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PrepareWorkspaceBranchesDTO {
  @Field(() => Int)
  objectsPrepared: number;

  @Field(() => Int)
  recordsAssigned: number;
}
