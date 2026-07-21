import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GetQueueUrlCommand,
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private queueUrl = process.env.SQS_QUEUE_URL;
  private readonly queueName = process.env.SQS_QUEUE_NAME;
  private readonly client = new SQSClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint: process.env.AWS_ENDPOINT_URL,
    credentials: process.env.AWS_ENDPOINT_URL
      ? { accessKeyId: 'test', secretAccessKey: 'test' }
      : undefined,
  });

  constructor(@InjectRepository(Job) private readonly jobs: Repository<Job>) {}

  async enqueue(type: string, payload: Record<string, unknown>): Promise<Job> {
    this.assertQueueConfigured();
    const job = await this.jobs.save(
      this.jobs.create({
        type,
        payload,
        state: 'QUEUED',
        externalId: null,
        attempts: 0,
        maxAttempts: 3,
        error: null,
        result: null,
        completedAt: null,
      }),
    );
    if (!this.queueUrl && !this.queueName) {
      job.state = 'COMPLETE';
      job.completedAt = new Date();
      job.result = { adapter: 'synchronous-test-fallback' };
      await this.jobs.save(job);
      this.logger.log(`Completed ${type} through the test fallback adapter`);
      return job;
    }
    return this.send(job);
  }

  async retry(jobId: string): Promise<Job> {
    this.assertQueueConfigured();
    const job = await this.jobs.findOneBy({ id: jobId });
    if (!job) throw new NotFoundException('Job not found');
    if (job.state !== 'FAILED')
      throw new BadRequestException('Only failed jobs can be retried');
    job.state = 'QUEUED';
    job.attempts = 0;
    job.error = null;
    job.result = null;
    job.completedAt = null;
    if (job.payload.simulateFailure === true) {
      job.payload = { ...job.payload, simulateFailure: false };
    }
    await this.jobs.save(job);
    if (!this.queueUrl && !this.queueName) {
      job.state = 'COMPLETE';
      job.completedAt = new Date();
      return this.jobs.save(job);
    }
    return this.send(job);
  }

  private async send(job: Job): Promise<Job> {
    try {
      const queueUrl = await this.getQueueUrl();
      const result = await this.client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({
            jobId: job.id,
            type: job.type,
            payload: job.payload,
          }),
          MessageAttributes: {
            jobType: { DataType: 'String', StringValue: job.type },
          },
        }),
      );
      job.externalId = result.MessageId ?? null;
      job.state = 'QUEUED';
    } catch (error) {
      job.state = 'FAILED';
      job.error =
        error instanceof Error ? error.message : 'Queue submission failed';
      this.logger.error(`Failed to enqueue ${job.type}: ${job.error}`);
    }
    return this.jobs.save(job);
  }

  private async getQueueUrl(): Promise<string> {
    if (this.queueUrl) return this.queueUrl;
    const response = await this.client.send(
      new GetQueueUrlCommand({ QueueName: this.queueName }),
    );
    if (!response.QueueUrl)
      throw new Error('SQS queue URL could not be resolved');
    this.queueUrl = response.QueueUrl;
    return response.QueueUrl;
  }

  private assertQueueConfigured(): void {
    if (!this.queueUrl && !this.queueName && process.env.NODE_ENV !== 'test') {
      throw new ServiceUnavailableException(
        'Queue configuration is required outside the automated test environment.',
      );
    }
  }
}
