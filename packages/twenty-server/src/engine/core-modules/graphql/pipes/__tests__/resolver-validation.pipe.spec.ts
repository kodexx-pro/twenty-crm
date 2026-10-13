import { type ArgumentMetadata } from '@nestjs/common';
import { IsString } from 'class-validator';

import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';

class ExampleInput {
  @IsString()
  name: string;
}

describe('ResolverValidationPipe', () => {
  const pipe = new ResolverValidationPipe();

  it('leaves the HTTP request context intact without calling its constructor', async () => {
    const request = new Request('https://example.test/graphql');

    await expect(
      pipe.transform(request, { type: 'custom', metatype: Request }),
    ).resolves.toBe(request);
  });

  it('does not traverse authenticated objects with cyclic request references', async () => {
    const request = new Request('https://example.test/graphql');
    const context = { request, workspace: { id: 'workspace' } };

    Object.assign(context.workspace, { context });

    await expect(
      pipe.transform(context, { type: 'custom', metatype: ExampleInput }),
    ).resolves.toBe(context);
  });

  const inputMetadata: ArgumentMetadata = {
    type: 'body',
    metatype: ExampleInput,
  };

  it('continues validating legitimate resolver inputs', async () => {
    const input = { name: 'Example' };

    await expect(pipe.transform(input, inputMetadata)).resolves.toBe(input);
  });

  it('continues rejecting invalid resolver inputs', async () => {
    await expect(pipe.transform({ name: 123 }, inputMetadata)).rejects.toThrow(
      'name must be a string',
    );
  });
});
