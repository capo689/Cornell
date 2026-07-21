import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  calculateReadiness,
  canCoverPart,
  isCompleteOrder,
} from './business-rules';
import { AuditEntry } from './entities/audit-entry.entity';
import { DemoEvent } from './entities/demo-event.entity';
import { Instrument } from './entities/instrument.entity';
import { Job } from './entities/job.entity';
import { Member } from './entities/member.entity';
import { RepertoireItem } from './entities/repertoire-item.entity';
import { QueueService } from './queue.service';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(DemoEvent) private readonly events: Repository<DemoEvent>,
    @InjectRepository(AuditEntry)
    private readonly audit: Repository<AuditEntry>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(Member) private readonly members: Repository<Member>,
    @InjectRepository(RepertoireItem)
    private readonly repertoire: Repository<RepertoireItem>,
    @InjectRepository(Instrument)
    private readonly instruments: Repository<Instrument>,
    private readonly dataSource: DataSource,
    private readonly queue: QueueService,
  ) {}

  async getState() {
    const event = await this.ensureDemoData();
    return {
      event,
      readiness: calculateReadiness(event),
      issues: event.absenceResolved ? 1 : 3,
      members: await this.members.find({
        order: { section: 'ASC', name: 'ASC' },
      }),
      repertoire: await this.repertoire.find({ order: { position: 'ASC' } }),
      instruments: await this.instruments.find({ order: { assetTag: 'ASC' } }),
      jobs: await this.jobs.find({ order: { createdAt: 'DESC' }, take: 12 }),
      audit: await this.audit.find({ order: { createdAt: 'DESC' }, take: 12 }),
    };
  }

  async resolveAbsence(actor: string, memberId: string) {
    return this.dataSource.transaction(async (manager) => {
      const event = await manager.getRepository(DemoEvent).findOneBy({
        slug: 'homecoming-field-show',
      });
      const member = await manager
        .getRepository(Member)
        .findOneBy({ id: memberId });
      if (!event) throw new NotFoundException('Demo event not found');
      if (!member) throw new NotFoundException('Substitute not found');
      if (!canCoverPart(member, 'tenor-sax-part-2')) {
        throw new BadRequestException(
          'This member is not an available, qualified substitute.',
        );
      }

      event.absenceResolved = true;
      event.substituteName = member.name;
      member.busAssignment = 'Bus 1 · Seat 18';
      member.status = 'substitute';
      await manager.getRepository(DemoEvent).save(event);
      await manager.getRepository(Member).save(member);

      const music = await manager
        .getRepository(RepertoireItem)
        .findOneBy({ position: 1 });
      if (music) {
        music.coverageStatus = 'ready';
        music.missingParts = 0;
        await manager.getRepository(RepertoireItem).save(music);
      }
      const instrument = await manager
        .getRepository(Instrument)
        .findOneBy({ assetTag: 'TS-021' });
      if (instrument) {
        instrument.assignee = member.name;
        instrument.status = 'assigned';
        await manager.getRepository(Instrument).save(instrument);
      }
      await manager.getRepository(AuditEntry).save({
        actor,
        action: 'ASSIGN_SUBSTITUTE',
        detail: `Assigned ${member.name} to tenor sax part 2, TS-021, and Bus 1 seat 18.`,
      });
      return event;
    });
  }

  async updateAvailability(
    actor: string,
    memberId: string,
    available: boolean,
  ) {
    const member = await this.members.findOneBy({ id: memberId });
    if (!member) throw new NotFoundException('Member not found');
    member.available = available;
    member.status = available ? 'confirmed' : 'unavailable';
    await this.members.save(member);
    await this.audit.save({
      actor,
      action: 'UPDATE_AVAILABILITY',
      detail: `${member.name} marked ${available ? 'available' : 'unavailable'}.`,
    });
    return member;
  }

  async reorderRepertoire(actor: string, itemIds: string[]) {
    const items = await this.repertoire.find();
    if (
      !isCompleteOrder(
        itemIds,
        items.map((item) => item.id),
      )
    ) {
      throw new BadRequestException(
        'Order must contain every repertoire item exactly once.',
      );
    }
    const byId = new Map(items.map((item) => [item.id, item]));
    await this.dataSource.transaction(async (manager) => {
      for (const [index, id] of itemIds.entries()) {
        const item = byId.get(id)!;
        item.position = index + 1;
        await manager.getRepository(RepertoireItem).save(item);
      }
      await manager.getRepository(AuditEntry).save({
        actor,
        action: 'REORDER_REPERTOIRE',
        detail: `Updated the four-song field show order.`,
      });
    });
    return this.repertoire.find({ order: { position: 'ASC' } });
  }

  async reportCondition(
    actor: string,
    instrumentId: string,
    condition: string,
    note?: string,
  ) {
    const instrument = await this.instruments.findOneBy({ id: instrumentId });
    if (!instrument) throw new NotFoundException('Instrument not found');
    instrument.condition = condition;
    instrument.note = note?.trim() || null;
    instrument.status =
      condition === 'repair'
        ? 'out-of-service'
        : condition === 'attention'
          ? 'inspect'
          : 'ready';
    await this.instruments.save(instrument);
    await this.audit.save({
      actor,
      action: 'REPORT_EQUIPMENT_CONDITION',
      detail: `${instrument.assetTag} marked ${condition}${instrument.note ? `: ${instrument.note}` : '.'}`,
    });
    return instrument;
  }

  async publish(actor: string) {
    const event = await this.ensureDemoData();
    if (!event.absenceResolved) {
      throw new ForbiddenException(
        'Resolve the uncovered part before publishing.',
      );
    }
    if (event.published) return event;
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
    const event = await this.ensureDemoData();
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
      await manager.getRepository(Member).clear();
      await manager.getRepository(RepertoireItem).clear();
      await manager.getRepository(Instrument).clear();
      const event = await manager
        .getRepository(DemoEvent)
        .findOneBy({ slug: 'homecoming-field-show' });
      if (event) {
        Object.assign(event, {
          absenceResolved: false,
          published: false,
          acknowledged: false,
          revision: 3,
          substituteName: null,
        });
        await manager.getRepository(DemoEvent).save(event);
      }
    });
    return this.getState();
  }

  private async ensureDemoData(): Promise<DemoEvent> {
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
        detail: 'Created the synthetic Homecoming demo event.',
      });
    }
    if ((await this.members.count()) === 0) {
      await this.members.save([
        {
          name: 'Jordan Lee',
          section: 'Saxes',
          instrument: 'Tenor sax',
          available: false,
          qualifiedParts: ['tenor-sax-part-2'],
          busAssignment: 'Bus 2',
          status: 'unavailable',
        },
        {
          name: 'Alex Rivera',
          section: 'Saxes',
          instrument: 'Tenor sax',
          available: true,
          qualifiedParts: ['tenor-sax-part-2'],
          busAssignment: null,
          status: 'available',
        },
        {
          name: 'Priya Shah',
          section: 'Saxes',
          instrument: 'Alto sax',
          available: true,
          qualifiedParts: ['alto-sax-part-1'],
          busAssignment: 'Bus 1',
          status: 'confirmed',
        },
        {
          name: 'Theo Brooks',
          section: 'Brass',
          instrument: 'Trumpet',
          available: true,
          qualifiedParts: ['trumpet-1'],
          busAssignment: 'Bus 1',
          status: 'confirmed',
        },
        {
          name: 'Sam Okafor',
          section: 'Percussion',
          instrument: 'Snare',
          available: true,
          qualifiedParts: ['snare'],
          busAssignment: 'Bus 2',
          status: 'confirmed',
        },
        {
          name: 'Lin Park',
          section: 'Guard',
          instrument: 'Field flag',
          available: true,
          qualifiedParts: ['guard'],
          busAssignment: 'Bus 2',
          status: 'confirmed',
        },
      ]);
    }
    if ((await this.repertoire.count()) === 0) {
      await this.repertoire.save([
        {
          title: 'Dancing in the Moonlight',
          artist: 'Toploader',
          position: 1,
          coverageStatus: 'missing',
          duration: '3:48',
          missingParts: 1,
        },
        {
          title: 'September',
          artist: 'Earth, Wind & Fire',
          position: 2,
          coverageStatus: 'ready',
          duration: '3:35',
          missingParts: 0,
        },
        {
          title: 'Take On Me',
          artist: 'a-ha',
          position: 3,
          coverageStatus: 'ready',
          duration: '3:46',
          missingParts: 0,
        },
        {
          title: 'Give My Regards to Davy',
          artist: 'Traditional',
          position: 4,
          coverageStatus: 'ready',
          duration: '1:52',
          missingParts: 0,
        },
      ]);
    }
    if ((await this.instruments.count()) === 0) {
      await this.instruments.save([
        {
          assetTag: 'TS-014',
          type: 'Tenor sax',
          assignee: 'Jordan Lee',
          status: 'ready',
          condition: 'good',
          note: null,
        },
        {
          assetTag: 'TS-021',
          type: 'Tenor sax',
          assignee: null,
          status: 'available',
          condition: 'good',
          note: null,
        },
        {
          assetTag: 'TR-008',
          type: 'Trumpet',
          assignee: 'Theo Brooks',
          status: 'inspect',
          condition: 'attention',
          note: 'Second valve feels sticky.',
        },
        {
          assetTag: 'SD-011',
          type: 'Snare',
          assignee: 'Sam Okafor',
          status: 'ready',
          condition: 'good',
          note: null,
        },
        {
          assetTag: 'FLG-004',
          type: 'Field flag',
          assignee: 'Lin Park',
          status: 'ready',
          condition: 'good',
          note: null,
        },
      ]);
    }
    return event;
  }
}
