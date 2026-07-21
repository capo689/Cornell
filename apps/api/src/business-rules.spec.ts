import {
  calculateReadiness,
  canCoverPart,
  isCompleteOrder,
} from './business-rules';

describe('Bandboard business rules', () => {
  it('calculates readiness from persisted workflow state', () => {
    expect(
      calculateReadiness({
        acknowledged: false,
        published: false,
        absenceResolved: false,
      }),
    ).toBe(82);
    expect(
      calculateReadiness({
        acknowledged: false,
        published: false,
        absenceResolved: true,
      }),
    ).toBe(91);
    expect(
      calculateReadiness({
        acknowledged: false,
        published: true,
        absenceResolved: true,
      }),
    ).toBe(94);
    expect(
      calculateReadiness({
        acknowledged: true,
        published: true,
        absenceResolved: true,
      }),
    ).toBe(100);
  });

  it('requires both availability and part qualification', () => {
    expect(
      canCoverPart({ available: true, qualifiedParts: ['tenor-2'] }, 'tenor-2'),
    ).toBe(true);
    expect(
      canCoverPart(
        { available: false, qualifiedParts: ['tenor-2'] },
        'tenor-2',
      ),
    ).toBe(false);
    expect(
      canCoverPart({ available: true, qualifiedParts: ['alto-1'] }, 'tenor-2'),
    ).toBe(false);
  });

  it('accepts only a complete, duplicate-free running order', () => {
    expect(isCompleteOrder(['c', 'a', 'b'], ['a', 'b', 'c'])).toBe(true);
    expect(isCompleteOrder(['a', 'a', 'b'], ['a', 'b', 'c'])).toBe(false);
    expect(isCompleteOrder(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
    expect(isCompleteOrder(['a', 'b', 'x'], ['a', 'b', 'c'])).toBe(false);
  });
});
