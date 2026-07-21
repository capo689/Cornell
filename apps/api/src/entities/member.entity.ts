import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('members')
@Index(['section', 'available'])
export class Member {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true, length: 120 }) name!: string;
  @Column({ length: 60 }) section!: string;
  @Column({ length: 80 }) instrument!: string;
  @Column({ default: true }) available!: boolean;
  @Column({ type: 'json' }) qualifiedParts!: string[];
  @Column({ type: 'varchar', length: 40, nullable: true }) busAssignment!:
    string | null;
  @Column({ length: 30, default: 'confirmed' }) status!: string;
}
