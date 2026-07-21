import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('repertoire_items')
@Index(['position'])
export class RepertoireItem {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 160 }) title!: string;
  @Column({ length: 120 }) artist!: string;
  @Column() position!: number;
  @Column({ length: 30, default: 'ready' }) coverageStatus!: string;
  @Column({ length: 20 }) duration!: string;
  @Column({ default: 0 }) missingParts!: number;
}
