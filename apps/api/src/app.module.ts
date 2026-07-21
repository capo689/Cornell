import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoordinatorGuard } from './coordinator.guard';
import { AuditEntry } from './entities/audit-entry.entity';
import { DemoEvent } from './entities/demo-event.entity';
import { Job } from './entities/job.entity';
import { QueueService } from './queue.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 3306),
      username: process.env.DB_USER ?? 'bandboard',
      password: process.env.DB_PASSWORD ?? 'bandboard',
      database: process.env.DB_NAME ?? 'bandboard',
      entities: [DemoEvent, AuditEntry, Job],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      retryAttempts: 8,
      retryDelay: 1500,
    }),
    TypeOrmModule.forFeature([DemoEvent, AuditEntry, Job]),
  ],
  controllers: [AppController],
  providers: [AppService, CoordinatorGuard, QueueService],
})
export class AppModule {}
