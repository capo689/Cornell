import {
  CreateDateColumn,
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_entries')
export class AuditEntry {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() actor!: string;
  @Column() action!: string;
  @Column({ length: 500 }) detail!: string;
  @CreateDateColumn() createdAt!: Date;
}
