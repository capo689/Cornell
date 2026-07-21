import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('demo_events')
export class DemoEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) slug!: string;
  @Column() name!: string;
  @Column() venue!: string;
  @Column({ type: 'datetime' }) callTime!: Date;
  @Column({ default: 3 }) revision!: number;
  @Column({ default: false }) absenceResolved!: boolean;
  @Column({ default: false }) published!: boolean;
  @Column({ default: false }) acknowledged!: boolean;
  @Column({ type: 'varchar', length: 120, nullable: true }) substituteName!:
    string | null;
  @UpdateDateColumn() updatedAt!: Date;
}
