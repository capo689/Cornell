import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('event_packets')
@Unique('UQ_event_packet_revision', ['eventId', 'revision'])
export class EventPacket {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() eventId!: string;
  @Column() revision!: number;
  @Column({ length: 500 }) objectKey!: string;
  @Column() byteSize!: number;
  @Column({ length: 64 }) checksum!: string;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
