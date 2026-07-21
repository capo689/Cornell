import {
  CreateDateColumn,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() type!: string;
  @Column({ default: 'QUEUED' }) state!: string;
  @Column({ type: 'json' }) payload!: Record<string, unknown>;
  @Column({ type: 'varchar', length: 120, nullable: true }) externalId!:
    string | null;
  @Column({ default: 0 }) attempts!: number;
  @Column({ default: 3 }) maxAttempts!: number;
  @Column({ type: 'text', nullable: true }) error!: string | null;
  @Column({ type: 'json', nullable: true }) result!: Record<
    string,
    unknown
  > | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
  @Column({ type: 'datetime', nullable: true }) completedAt!: Date | null;
}
