import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { DemoEvent } from './entities/demo-event.entity';
import type { Instrument } from './entities/instrument.entity';
import type { Member } from './entities/member.entity';
import type { RepertoireItem } from './entities/repertoire-item.entity';

interface PacketData {
  event: DemoEvent;
  members: Member[];
  repertoire: RepertoireItem[];
  instruments: Instrument[];
}

@Injectable()
export class PacketDocumentService {
  async generate(data: PacketData): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({
        size: 'LETTER',
        margins: { top: 42, right: 46, bottom: 42, left: 46 },
        info: {
          Title: `Bandboard event packet - revision ${data.event.revision}`,
          Author: 'Bandboard synthetic demo',
          Subject: 'Homecoming field show operations packet',
        },
      });
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);

      const red = '#b31b1b';
      const ink = '#121820';
      const muted = '#68717c';
      const gold = '#c9962f';
      const paper = '#f7f3ec';

      document.rect(0, 0, 612, 112).fill(red);
      document
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('CORNELL BIG RED MARCHING BAND', 46, 30, {
          characterSpacing: 1.2,
        });
      document
        .font('Times-Bold')
        .fontSize(28)
        .text('HOMECOMING FIELD SHOW', 46, 50, {
          width: 410,
          lineBreak: false,
        });
      document
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(`REVISION ${data.event.revision}`, 478, 39, {
          width: 88,
          align: 'right',
        });
      document
        .font('Helvetica')
        .fontSize(7)
        .text('SYNTHETIC DEMO PACKET', 460, 64, {
          width: 106,
          align: 'right',
          lineBreak: false,
        });

      document.fillColor(ink).font('Helvetica-Bold').fontSize(9);
      document.text('SATURDAY, OCTOBER 18, 2025', 46, 137);
      document.fillColor(muted).font('Helvetica').fontSize(9);
      document.text(`${data.event.venue}, Ithaca, NY`, 46, 154);

      const summary = [
        ['CALL TIME', '11:30 AM', 'Fischell Band Center'],
        ['TRAVEL', 'Bus 1', 'Board at 12:55 PM'],
        ['UNIFORM', 'Full uniform', 'Pack rain shell'],
      ];
      summary.forEach(([label, value, note], index) => {
        const x = 46 + index * 174;
        document
          .roundedRect(x, 182, 158, 68, 5)
          .fillAndStroke(paper, '#ded7cc');
        document
          .fillColor(red)
          .font('Helvetica-Bold')
          .fontSize(7)
          .text(label, x + 12, 194);
        document
          .fillColor(ink)
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(value, x + 12, 210);
        document
          .fillColor(muted)
          .font('Helvetica')
          .fontSize(7.5)
          .text(note, x + 12, 228);
      });

      document
        .fillColor(red)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('RUN OF SHOW', 46, 282, {
          characterSpacing: 1.1,
        });
      const schedule = [
        ['12:10 PM', 'Music rehearsal', 'Rehearsal room A'],
        ['1:15 PM', 'March to stadium', 'Form at west entrance'],
        ['2:05 PM', 'Pregame show', 'Schoellkopf Field'],
        ['3:35 PM', 'Halftime', '8:30 performance block'],
      ];
      schedule.forEach(([time, title, note], index) => {
        const y = 310 + index * 55;
        if (index < schedule.length - 1)
          document.rect(120, y + 18, 1, 42).fill('#ded7cc');
        document.circle(120.5, y + 14, 4).fillAndStroke(gold, '#ffffff');
        document
          .fillColor(muted)
          .font('Helvetica')
          .fontSize(8)
          .text(time, 46, y + 9, { width: 58 });
        document
          .fillColor(ink)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(title, 142, y + 5);
        document
          .fillColor(muted)
          .font('Helvetica')
          .fontSize(8)
          .text(note, 142, y + 21);
      });

      const assigned = data.event.substituteName ?? 'Coverage pending';
      const tenor =
        data.instruments.find((item) => item.assignee === assigned) ??
        data.instruments.find((item) => item.assetTag === 'TS-021');
      document
        .roundedRect(350, 282, 216, 111, 7)
        .fillAndStroke('#ffffff', '#ded7cc');
      document
        .fillColor(red)
        .font('Helvetica-Bold')
        .fontSize(7)
        .text('ASSIGNMENT UPDATE', 366, 298);
      document
        .fillColor(ink)
        .font('Times-Bold')
        .fontSize(17)
        .text('Tenor saxophone', 366, 318);
      document
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(8)
        .text(`Part 2 - ${assigned}`, 366, 345);
      document.text(
        `Instrument ${tenor?.assetTag ?? 'TS-021'} - Bus 1 seat 18`,
        366,
        360,
      );

      document
        .roundedRect(350, 410, 216, 117, 7)
        .fillAndStroke(paper, '#ded7cc');
      document
        .fillColor(red)
        .font('Helvetica-Bold')
        .fontSize(7)
        .text('REPERTOIRE', 366, 426);
      data.repertoire.slice(0, 4).forEach((item, index) => {
        document
          .fillColor(ink)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(`${index + 1}. ${item.title}`, 366, 445 + index * 18, {
            width: 145,
          });
        document
          .fillColor(muted)
          .font('Helvetica')
          .fontSize(7)
          .text(item.duration, 518, 445 + index * 18, {
            width: 32,
            align: 'right',
          });
      });

      document.moveTo(46, 560).lineTo(566, 560).strokeColor('#ded7cc').stroke();
      document
        .fillColor(red)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text('BRING WITH YOU', 46, 580);
      document.fillColor(ink).font('Helvetica').fontSize(9);
      ['Full uniform', 'Rain shell', 'Music packet', 'Water bottle'].forEach(
        (item, index) => {
          document
            .rect(
              46 + (index % 2) * 174,
              605 + Math.floor(index / 2) * 28,
              8,
              8,
            )
            .strokeColor(gold)
            .stroke();
          document.text(
            item,
            62 + (index % 2) * 174,
            603 + Math.floor(index / 2) * 28,
          );
        },
      );

      document
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(7)
        .text(
          `Generated by Bandboard at ${new Date().toISOString()} - synthetic portfolio data only`,
          46,
          718,
          { width: 520, align: 'center', lineBreak: false },
        );
      document.end();
    });
  }
}
