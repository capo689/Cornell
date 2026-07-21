import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditEntry } from './entities/audit-entry.entity';
import { DemoEvent } from './entities/demo-event.entity';
import { Job } from './entities/job.entity';
import { QueueService } from './queue.service';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(DemoEvent) private readonly events: Repository<DemoEvent>,
    @InjectRepository(AuditEntry)
    private readonly audit: Repository<AuditEntry>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    private readonly dataSource: DataSource,
    private readonly queue: QueueService,
  ) {}

  async getState() {
    const event = await this.ensureDemoEvent();
    return {
      event,
      readiness: event.acknowledged
        ? 100
        : event.published
          ? 94
          : event.absenceResolved
            ? 91
            : 82,
      issues: event.absenceResolved ? 1 : 3,
      jobs: await this.jobs.find({ order: { createdAt: 'DESC' }, take: 12 }),
      audit: await this.audit.find({ order: { createdAt: 'DESC' }, take: 12 }),
    };
  }

  async resolveAbsence(actor: string) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(DemoEvent);
      const event = await repository.findOneBy({
        slug: 'homecoming-field-show',
      });
      if (!event) throw new NotFoundException('Demo event not found');
      event.absenceResolved = true;
      event.substituteName = 'Alex Rivera';
      await repository.save(event);
      await manager.getRepository(AuditEntry).save({
        actor,
        action: 'ASSIGN_SUBSTITUTE',
        detail: 'Assigned Alex Rivera to tenor sax part 2 and Bus 1 seat 18.',
      });
      return event;
    });
  }

  async publish(actor: string) {
    const event = await this.ensureDemoEvent();
    if (!event.absenceResolved) {
      throw new ForbiddenException(
        'Resolve the uncovered part before publishing.',
      );
    }
    event.published = true;
    event.revision = 4;
    await this.events.save(event);
    await this.audit.save({
      actor,
      action: 'PUBLISH_REVISION',
      detail: 'Published event revision 4.',
    });
    await Promise.all([
      this.queue.enqueue('GENERATE_PACKET', { eventId: event.id, revision: 4 }),
      this.queue.enqueue('NOTIFY_MEMBERS', { eventId: event.id, revision: 4 }),
      this.queue.enqueue('RECALCULATE_READINESS', { eventId: event.id }),
    ]);
    return event;
  }

  async acknowledge(actor: string) {
    const event = await this.ensureDemoEvent();
    if (!event.published)
      throw new ForbiddenException('No published revision to acknowledge.');
    event.acknowledged = true;
    await this.events.save(event);
    await this.audit.save({
      actor,
      action: 'ACKNOWLEDGE_REVISION',
      detail: 'Acknowledged event revision 4.',
    });
    return event;
  }

  async reset() {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(AuditEntry).clear();
      await manager.getRepository(Job).clear();
      const event = await manager
        .getRepository(DemoEvent)
        .findOneBy({ slug: 'homecoming-field-show' });
      if (event) {
        event.absenceResolved = false;
        event.published = false;
        event.acknowledged = false;
        event.revision = 3;
        event.substituteName = null;
        await manager.getRepository(DemoEvent).save(event);
      }
    });
    return this.getState();
  }

  private async ensureDemoEvent(): Promise<DemoEvent> {
    let event = await this.events.findOneBy({ slug: 'homecoming-field-show' });
    if (!event) {
      event = await this.events.save({
        slug: 'homecoming-field-show',
        name: 'Homecoming field show',
        venue: 'Schoellkopf Field',
        callTime: new Date('2025-10-18T11:30:00-04:00'),
        revision: 3,
        absenceResolved: false,
        published: false,
        acknowledged: false,
        substituteName: null,
      });
      await this.audit.save({
        actor: 'System',
        action: 'SEED_DEMO',
        detail: 'Created the Homecoming demo event.',
      });
    }
    return event;
  }
}
