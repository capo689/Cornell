import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DemoEvent } from './entities/demo-event.entity';
import { EventPacket } from './entities/event-packet.entity';
import { Instrument } from './entities/instrument.entity';
import { Member } from './entities/member.entity';
import { RepertoireItem } from './entities/repertoire-item.entity';
import { PacketDocumentService } from './packet-document.service';
import { StorageService } from './storage.service';

@Injectable()
export class PacketService {
  constructor(
    @InjectRepository(DemoEvent) private readonly events: Repository<DemoEvent>,
    @InjectRepository(EventPacket)
    private readonly packets: Repository<EventPacket>,
    @InjectRepository(Member) private readonly members: Repository<Member>,
    @InjectRepository(RepertoireItem)
    private readonly repertoire: Repository<RepertoireItem>,
    @InjectRepository(Instrument)
    private readonly instruments: Repository<Instrument>,
    private readonly documents: PacketDocumentService,
    private readonly storage: StorageService,
  ) {}

  async generate(eventId: string, revision: number) {
    const event = await this.events.findOneBy({ id: eventId });
    if (!event) throw new NotFoundException('Packet event not found');
    const body = await this.documents.generate({
      event,
      members: await this.members.find({ order: { name: 'ASC' } }),
      repertoire: await this.repertoire.find({ order: { position: 'ASC' } }),
      instruments: await this.instruments.find({ order: { assetTag: 'ASC' } }),
    });
    const objectKey = `events/${event.slug}/revision-${revision}/event-packet.pdf`;
    const stored = await this.storage.putPacket(objectKey, body);
    let packet = await this.packets.findOneBy({ eventId, revision });
    packet ??= this.packets.create({ eventId, revision });
    Object.assign(packet, {
      objectKey: stored.key,
      byteSize: stored.byteSize,
      checksum: stored.checksum,
    });
    return this.packets.save(packet);
  }

  async getStatus(event: DemoEvent) {
    const packet = await this.packets.findOneBy({
      eventId: event.id,
      revision: event.revision,
    });
    if (!packet) {
      return {
        status: event.published ? 'GENERATING' : 'NOT_GENERATED',
        revision: event.revision,
        byteSize: null,
        generatedAt: null,
      };
    }
    return {
      status: 'READY',
      revision: packet.revision,
      byteSize: packet.byteSize,
      checksum: packet.checksum,
      generatedAt: packet.updatedAt,
    };
  }

  async getDownload(event: DemoEvent) {
    const packet = await this.packets.findOneBy({
      eventId: event.id,
      revision: event.revision,
    });
    if (!packet)
      throw new NotFoundException('The generated packet is not ready yet.');
    return {
      status: 'READY',
      revision: packet.revision,
      expiresInSeconds: 300,
      downloadUrl: await this.storage.getSignedDownloadUrl(packet.objectKey),
    };
  }

  async clear(): Promise<void> {
    const packets = await this.packets.find();
    for (const packet of packets) {
      await this.storage.deleteObject(packet.objectKey).catch(() => undefined);
    }
    await this.packets.clear();
  }
}
