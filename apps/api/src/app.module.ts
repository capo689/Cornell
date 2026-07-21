import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoordinatorGuard } from './coordinator.guard';
import { AuditEntry } from './entities/audit-entry.entity';
import { DemoEvent } from './entities/demo-event.entity';
import { Job } from './entities/job.entity';
import { Instrument } from './entities/instrument.entity';
import { Member } from './entities/member.entity';
import { RepertoireItem } from './entities/repertoire-item.entity';
import { InitialSchema1760000000000 } from './migrations/1760000000000-initial-schema';
import { QueueService } from './queue.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3306),
      username: process.env.DB_USER ?? 'bandboard',
      password: process.env.DB_PASSWORD ?? 'bandboard',
      database: process.env.DB_NAME ?? 'bandboard',
      entities: [
        DemoEvent,
        AuditEntry,
        Job,
        Member,
        RepertoireItem,
        Instrument,
      ],
      migrations: [InitialSchema1760000000000],
      migrationsRun: true,
      synchronize: false,
      retryAttempts: 8,
      retryDelay: 1500,
    }),
    TypeOrmModule.forFeature([
      DemoEvent,
      AuditEntry,
      Job,
      Member,
      RepertoireItem,
      Instrument,
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    CoordinatorGuard,
    QueueService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
