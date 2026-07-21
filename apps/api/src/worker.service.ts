import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  GetQueueUrlCommand,
  MessageSystemAttributeName,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity';
import { JobProcessorService } from './job-processor.service';

interface QueueMessage {
  jobId: string;
}

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);
  private queueUrl = process.env.SQS_QUEUE_URL;
  private readonly queueName = process.env.SQS_QUEUE_NAME;
  private readonly client = new SQSClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint: process.env.AWS_ENDPOINT_URL,
    credentials: process.env.AWS_ENDPOINT_URL
      ? { accessKeyId: 'test', secretAccessKey: 'test' }
      : undefined,
  });

  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    private readonly processor: JobProcessorService,
  ) {}

  async run(signal: AbortSignal): Promise<void> {
    if (!this.queueUrl && !this.queueName)
      throw new Error(
        'SQS_QUEUE_URL or SQS_QUEUE_NAME is required for the worker.',
      );
    this.logger.log('Bandboard worker is polling SQS.');
    while (!signal.aborted) {
      try {
        await this.pollOnce();
      } catch (error) {
        this.logger.error(
          `Worker poll failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async pollOnce(): Promise<number> {
    const queueUrl = await this.getQueueUrl();
    const response = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 2,
        VisibilityTimeout: 8,
        MessageSystemAttributeNames: [
          MessageSystemAttributeName.ApproximateReceiveCount,
        ],
      }),
    );
    for (const message of response.Messages ?? []) {
      await this.processMessage(
        message.Body ?? '',
        message.ReceiptHandle ?? '',
        Number(message.Attributes?.ApproximateReceiveCount ?? 1),
      );
    }
    return response.Messages?.length ?? 0;
  }

  private async processMessage(
    body: string,
    receiptHandle: string,
    receiveCount: number,
  ): Promise<void> {
    if (!receiptHandle) return;
    const queueUrl = await this.getQueueUrl();
    const parsed = JSON.parse(body) as QueueMessage;
    const job = await this.jobs.findOneBy({ id: parsed.jobId });
    if (!job || job.state === 'COMPLETE') {
      await this.deleteMessage(receiptHandle);
      return;
    }
    job.state = 'PROCESSING';
    job.attempts = receiveCount;
    job.error = null;
    await this.jobs.save(job);
    try {
      job.result = await this.processor.process(job);
      job.state = 'COMPLETE';
      job.completedAt = new Date();
      await this.jobs.save(job);
      await this.deleteMessage(receiptHandle);
      this.logger.log(`Completed ${job.type} job ${job.id}.`);
    } catch (error) {
      job.error =
        error instanceof Error ? error.message : 'Unknown worker error';
      job.state = receiveCount >= job.maxAttempts ? 'FAILED' : 'RETRYING';
      await this.jobs.save(job);
      this.logger.warn(
        `${job.type} job ${job.id} ${job.state.toLowerCase()} after attempt ${receiveCount}.`,
      );
      if (job.state === 'RETRYING') {
        await this.client.send(
          new ChangeMessageVisibilityCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: receiptHandle,
            VisibilityTimeout: 2,
          }),
        );
      }
    }
  }

  private async deleteMessage(receiptHandle: string): Promise<void> {
    const queueUrl = await this.getQueueUrl();
    await this.client.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
      }),
    );
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
}
