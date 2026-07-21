import type { DemoEvent } from './entities/demo-event.entity';
import type { Instrument } from './entities/instrument.entity';
import type { Member } from './entities/member.entity';
import type { RepertoireItem } from './entities/repertoire-item.entity';
import { PacketDocumentService } from './packet-document.service';

describe('PacketDocumentService', () => {
  it('builds a non-trivial PDF event packet', async () => {
    const service = new PacketDocumentService();
    const packet = await service.generate({
      event: {
        revision: 4,
        venue: 'Schoellkopf Field',
        substituteName: 'Alex Rivera',
      } as DemoEvent,
      members: [] as Member[],
      instruments: [{ type: 'Tenor sax', assetTag: 'TS-021' } as Instrument],
      repertoire: ['Give My Regards to Davy', 'Alma Mater', 'Louie Louie'].map(
        (title, index) =>
          ({ title, duration: `0${index + 2}:30` }) as RepertoireItem,
      ),
    });

    expect(packet.subarray(0, 4).toString()).toBe('%PDF');
    expect(packet.byteLength).toBeGreaterThan(3_000);
    expect(packet.subarray(-16).toString()).toContain('%%EOF');
    const pageCount = packet
      .toString('latin1')
      .match(/\/Type \/Page\b/g)?.length;
    expect(pageCount).toBe(1);
  });
});
