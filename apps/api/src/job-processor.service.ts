import { Injectable } from '@nestjs/common';
import type { Job } from './entities/job.entity';
import { PacketService } from './packet.service';

@Injectable()
export class JobProcessorService {
  constructor(private readonly packets: PacketService) {}

  async process(job: Job): Promise<Record<string, unknown>> {
    if (job.payload.simulateFailure === true) {
      throw new Error(
        'Synthetic worker failure requested for recovery testing.',
      );
    }
    switch (job.type) {
      case 'GENERATE_PACKET': {
        const eventId =
          typeof job.payload.eventId === 'string' ? job.payload.eventId : '';
        const revision =
          typeof job.payload.revision === 'number' ? job.payload.revision : 0;
        const packet = await this.packets.generate(eventId, revision);
        return {
          packetId: packet.id,
          revision: packet.revision,
          byteSize: packet.byteSize,
          checksum: packet.checksum,
        };
      }
      case 'NOTIFY_MEMBERS':
        return {
          delivered: 6,
          channel: 'synthetic-demo-notification',
        };
      case 'RECALCULATE_READINESS':
        return { recalculated: true };
      default:
        throw new Error(`Unsupported job type: ${job.type}`);
    }
  }
}
