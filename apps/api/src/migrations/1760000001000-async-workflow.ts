import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AsyncWorkflow1760000001000 implements MigrationInterface {
  name = 'AsyncWorkflow1760000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE jobs
      ADD attempts int NOT NULL DEFAULT 0,
      ADD maxAttempts int NOT NULL DEFAULT 3,
      ADD error text NULL,
      ADD result json NULL,
      ADD updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      ADD completedAt datetime NULL`);
    await queryRunner.query(`CREATE TABLE event_packets (
      id varchar(36) NOT NULL, eventId varchar(36) NOT NULL, revision int NOT NULL,
      objectKey varchar(500) NOT NULL, byteSize int NOT NULL, checksum varchar(64) NOT NULL,
      createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      UNIQUE KEY UQ_event_packet_revision (eventId, revision), PRIMARY KEY (id)
    ) ENGINE=InnoDB`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS event_packets');
    await queryRunner.query(`ALTER TABLE jobs
      DROP COLUMN completedAt,
      DROP COLUMN updatedAt,
      DROP COLUMN result,
      DROP COLUMN error,
      DROP COLUMN maxAttempts,
      DROP COLUMN attempts`);
  }
}
