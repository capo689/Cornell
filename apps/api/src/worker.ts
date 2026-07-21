import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WorkerService } from './worker.service';

async function bootstrap() {
  const application = await NestFactory.createApplicationContext(AppModule);
  const controller = new AbortController();
  const shutdown = () => controller.abort();
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  await application.get(WorkerService).run(controller.signal);
  await application.close();
}

void bootstrap();
