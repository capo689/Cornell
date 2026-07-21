import {
  CreateDateColumn,
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() type!: string;
  @Column({ default: 'QUEUED' }) state!: string;
  @Column({ type: 'json' }) payload!: Record<string, unknown>;
  @Column({ type: 'varchar', length: 120, nullable: true }) externalId!:
    string | null;
  @CreateDateColumn() createdAt!: Date;
}
