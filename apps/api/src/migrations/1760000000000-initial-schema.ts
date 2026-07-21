import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1760000000000 implements MigrationInterface {
  name = 'InitialSchema1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS demo_events (
      id varchar(36) NOT NULL, slug varchar(255) NOT NULL, name varchar(255) NOT NULL,
      venue varchar(255) NOT NULL, callTime datetime NOT NULL, revision int NOT NULL DEFAULT 3,
      absenceResolved tinyint NOT NULL DEFAULT 0, published tinyint NOT NULL DEFAULT 0,
      acknowledged tinyint NOT NULL DEFAULT 0, substituteName varchar(120) NULL,
      updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      UNIQUE KEY UQ_demo_event_slug (slug), PRIMARY KEY (id)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS audit_entries (
      id varchar(36) NOT NULL, actor varchar(255) NOT NULL, action varchar(255) NOT NULL,
      detail varchar(500) NOT NULL, createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS jobs (
      id varchar(36) NOT NULL, type varchar(255) NOT NULL, state varchar(255) NOT NULL DEFAULT 'QUEUED',
      payload json NOT NULL, externalId varchar(120) NULL,
      createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (id)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS members (
      id varchar(36) NOT NULL, name varchar(120) NOT NULL, section varchar(60) NOT NULL,
      instrument varchar(80) NOT NULL, available tinyint NOT NULL DEFAULT 1,
      qualifiedParts json NOT NULL, busAssignment varchar(40) NULL,
      status varchar(30) NOT NULL DEFAULT 'confirmed', UNIQUE KEY UQ_member_name (name),
      INDEX IDX_member_section_available (section, available), PRIMARY KEY (id)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS repertoire_items (
      id varchar(36) NOT NULL, title varchar(160) NOT NULL, artist varchar(120) NOT NULL,
      position int NOT NULL, coverageStatus varchar(30) NOT NULL DEFAULT 'ready',
      duration varchar(20) NOT NULL, missingParts int NOT NULL DEFAULT 0,
      INDEX IDX_repertoire_position (position), PRIMARY KEY (id)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS instruments (
      id varchar(36) NOT NULL, assetTag varchar(30) NOT NULL, type varchar(80) NOT NULL,
      assignee varchar(120) NULL, status varchar(30) NOT NULL DEFAULT 'ready',
      \`condition\` varchar(30) NOT NULL DEFAULT 'good', note varchar(300) NULL,
      UNIQUE KEY UQ_instrument_tag (assetTag), INDEX IDX_instrument_type_status (type, status),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS instruments');
    await queryRunner.query('DROP TABLE IF EXISTS repertoire_items');
    await queryRunner.query('DROP TABLE IF EXISTS members');
    await queryRunner.query('DROP TABLE IF EXISTS jobs');
    await queryRunner.query('DROP TABLE IF EXISTS audit_entries');
    await queryRunner.query('DROP TABLE IF EXISTS demo_events');
  }
}
