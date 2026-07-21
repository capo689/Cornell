import type { Job } from './entities/job.entity';
import { JobProcessorService } from './job-processor.service';
import type { PacketService } from './packet.service';

describe('JobProcessorService', () => {
  const generatePacket = jest.fn();
  const packets = {
    generate: generatePacket,
  } as unknown as PacketService;
  const service = new JobProcessorService(packets);

  beforeEach(() => jest.clearAllMocks());

  it('returns the generated packet metadata', async () => {
    generatePacket.mockResolvedValue({
      id: 'packet-1',
      revision: 4,
      byteSize: 8_192,
      checksum: 'abc123',
    });
    const result = await service.process({
      type: 'GENERATE_PACKET',
      payload: { eventId: 'event-1', revision: 4 },
    } as Job);

    expect(generatePacket).toHaveBeenCalledWith('event-1', 4);
    expect(result.packetId).toBe('packet-1');
    expect(result.byteSize).toBe(8_192);
  });

  it('creates a controlled failure for the recovery drill', async () => {
    let error: unknown;
    try {
      await service.process({
        type: 'RECALCULATE_READINESS',
        payload: { simulateFailure: true },
      } as Job);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('Synthetic worker failure');
  });
});
