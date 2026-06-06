import { Injectable, Logger } from '@nestjs/common';

export interface MessFlagNotification {
  kind: 'mess-flag';
  householdId: string;
  assigneeId: string;
  flaggerName: string;
  taskTitle: string;
}

export interface BloomNotification {
  kind: 'bloom';
  householdId: string;
}

export type Notification = MessFlagNotification | BloomNotification;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // Stub: logs only. A future channel adapter (email, push, in-app) can
  // replace this without touching call sites.
  async send(notification: Notification): Promise<void> {
    this.logger.log(`notify ${notification.kind} ${JSON.stringify(notification)}`);
  }
}
