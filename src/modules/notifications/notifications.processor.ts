import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';

@Injectable()
@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  async process(job: Job): Promise<void> {
    void job.data;
    await Promise.resolve();
  }
}
