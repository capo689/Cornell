import { ForbiddenException } from '@nestjs/common';
import { CoordinatorGuard } from './coordinator.guard';

describe('CoordinatorGuard', () => {
  const context = (role: string) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ header: () => role }) }),
    }) as never;

  it('permits coordinator mutations', () => {
    expect(new CoordinatorGuard().canActivate(context('coordinator'))).toBe(
      true,
    );
  });

  it('rejects member mutations', () => {
    expect(() => new CoordinatorGuard().canActivate(context('member'))).toThrow(
      ForbiddenException,
    );
  });
});
