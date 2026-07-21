import type { DemoEvent } from './entities/demo-event.entity';
import type { Member } from './entities/member.entity';

export function calculateReadiness(
  event: Pick<DemoEvent, 'acknowledged' | 'published' | 'absenceResolved'>,
): number {
  if (event.acknowledged) return 100;
  if (event.published) return 94;
  if (event.absenceResolved) return 91;
  return 82;
}

export function canCoverPart(
  member: Pick<Member, 'available' | 'qualifiedParts'>,
  part: string,
): boolean {
  return member.available && member.qualifiedParts.includes(part);
}

export function isCompleteOrder(
  itemIds: string[],
  existingIds: string[],
): boolean {
  return (
    itemIds.length === existingIds.length &&
    new Set(itemIds).size === itemIds.length &&
    itemIds.every((id) => existingIds.includes(id))
  );
}
