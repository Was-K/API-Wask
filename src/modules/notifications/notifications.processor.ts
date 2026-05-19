import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Injectable()
@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  async process(job: Job): Promise<void> {
    this.logger.debug(`Processing notification job ${job.id} (attempt ${job.attemptsMade + 1})`);
    // TODO: integrate email/push delivery (SMTP / FCM)
    this.logger.log(`Notification delivered: type=${String(job.data?.type)} userId=${String(job.data?.userId)}`);
  }
}
