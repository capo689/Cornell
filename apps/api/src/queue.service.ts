import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly queueUrl = process.env.SQS_QUEUE_URL;
  private readonly client = new SQSClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint: process.env.AWS_ENDPOINT_URL,
    credentials: process.env.AWS_ENDPOINT_URL
      ? { accessKeyId: 'test', secretAccessKey: 'test' }
      : undefined,
  });

  constructor(@InjectRepository(Job) private readonly jobs: Repository<Job>) {}

  async enqueue(type: string, payload: Record<string, unknown>): Promise<Job> {
    const job = await this.jobs.save(
      this.jobs.create({ type, payload, state: 'QUEUED', externalId: null }),
    );
    if (!this.queueUrl) {
      job.state = 'COMPLETE';
      await this.jobs.save(job);
      this.logger.log(`Completed ${type} through the local demo adapter`);
      return job;
    }
    const result = await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({ jobId: job.id, type, payload }),
      }),
    );
    job.externalId = result.MessageId ?? null;
    job.state = 'QUEUED';
    return this.jobs.save(job);
  }
}
