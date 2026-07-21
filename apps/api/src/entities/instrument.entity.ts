import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('instruments')
@Index(['type', 'status'])
export class Instrument {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true, length: 30 }) assetTag!: string;
  @Column({ length: 80 }) type!: string;
  @Column({ type: 'varchar', length: 120, nullable: true }) assignee!:
    string | null;
  @Column({ length: 30, default: 'ready' }) status!: string;
  @Column({ length: 30, default: 'good' }) condition!: string;
  @Column({ type: 'varchar', length: 300, nullable: true }) note!:
    string | null;
}
