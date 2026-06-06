import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LandlordMode, TaskCadence, TaskKind, TaskStatus, TaskWeight } from '@prisma/client';
import {
  REACTIVE_DEFAULT_DUE_HOURS,
  REACTIVE_DEFAULT_TITLE,
  nextRecurrenceDueAt,
  normalizeChoreTitle,
  requiresPhotoEvidence,
  taskPolicy,
  type CompleteTaskInput,
  type CreateCaretakerTaskInput,
  type CreateTaskInput,
  type FlagMessInput,
  type HouseholdScope,
  type UpdateTaskInput,
} from '@homebuddy/shared';
import { HarmonyService } from '../harmony/harmony.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmartRotationService } from './smart-rotation.service';

const taskInclude = {
  assignee: { select: { id: true, name: true } },
  flaggedBy: { select: { id: true, name: true } },
  completedBy: { select: { id: true, name: true } },
} as const;

const MS_PER_HOUR = 60 * 60 * 1000;
const OVERDUE_GRACE_HOURS = 6;
const SNOOZE_HOURS = 24;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rotation: SmartRotationService,
    private readonly harmony: HarmonyService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(scope: HouseholdScope, input: CreateTaskInput) {
    const decision = await this.rotation.pickAssignee(
      scope.householdId,
      input.title,
      input.weight,
    );

    return this.prisma.task.create({
      data: {
        householdId: scope.householdId,
        title: input.title,
        titleSlug: normalizeChoreTitle(input.title),
        weight: input.weight,
        cadence: (input.cadence ?? 'once') as TaskCadence,
        dueAt: new Date(input.dueAt),
        assigneeId: decision.userId,
        rotationReason: decision.reason,
      },
      include: taskInclude,
    });
  }

  async createCaretakerChore(scope: HouseholdScope, input: CreateCaretakerTaskInput) {
    const caretaker = await this.prisma.landlordProperty.findFirst({
      where: {
        householdId: scope.householdId,
        mode: LandlordMode.caretaker,
        consentGranted: true,
      },
      select: { landlordId: true },
    });
    if (!caretaker) {
      throw new BadRequestException(
        'Link a consented caretaker landlord before assigning common-area chores.',
      );
    }

    return this.prisma.task.create({
      data: {
        householdId: scope.householdId,
        title: input.title,
        titleSlug: normalizeChoreTitle(input.title),
        weight: input.weight,
        dueAt: new Date(input.dueAt),
        assigneeId: caretaker.landlordId,
        caretakerOwned: true,
      },
      include: taskInclude,
    });
  }

  async flagMess(scope: HouseholdScope, input: FlagMessInput) {
    const title = (input.title?.trim() || REACTIVE_DEFAULT_TITLE).slice(0, 120);
    const weight = TaskWeight.heavy;

    const decision = await this.rotation.pickAssignee(
      scope.householdId,
      title,
      weight,
    );

    const task = await this.prisma.task.create({
      data: {
        householdId: scope.householdId,
        title,
        titleSlug: normalizeChoreTitle(title),
        weight,
        kind: TaskKind.reactive,
        dueAt: new Date(Date.now() + REACTIVE_DEFAULT_DUE_HOURS * MS_PER_HOUR),
        assigneeId: decision.userId,
        rotationReason: decision.reason,
        flaggedById: scope.userId,
        beforePhotoUrl: input.photoDataUrl,
      },
      include: taskInclude,
    });

    await this.prisma.messFlag.create({
      data: {
        householdId: scope.householdId,
        flaggerId: scope.userId,
        taskId: task.id,
        title,
        photoUrl: input.photoDataUrl,
      },
    });

    const flagger = await this.prisma.user.findUnique({
      where: { id: scope.userId },
      select: { name: true },
    });
    await this.notifications.send({
      kind: 'mess-flag',
      householdId: scope.householdId,
      assigneeId: decision.userId,
      flaggerName: flagger?.name ?? 'A housemate',
      taskTitle: title,
    });

    return task;
  }

  async listForHousehold(scope: HouseholdScope) {
    await this.sweepOverdue(scope.householdId);
    return this.prisma.task.findMany({
      where: { householdId: scope.householdId },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
      include: taskInclude,
    });
  }

  async listAssignedToMe(scope: HouseholdScope) {
    return this.prisma.task.findMany({
      where: {
        householdId: scope.householdId,
        assigneeId: scope.userId,
        status: { not: TaskStatus.completed },
      },
      orderBy: { dueAt: 'asc' },
      include: taskInclude,
    });
  }

  async complete(scope: HouseholdScope, taskId: string, input: CompleteTaskInput = {}) {
    const task = await this.findTaskInHousehold(taskId, scope.householdId);
    if (!taskPolicy.canComplete(scope, task)) throw new ForbiddenException();

    if (task.status === TaskStatus.completed) {
      throw new ForbiddenException('Task already completed');
    }

    if (requiresPhotoEvidence(task.weight) && !input.photoDataUrl) {
      throw new BadRequestException(
        'Heavy chores need a photo as proof of completion',
      );
    }

    const completedOnTime =
      task.status === TaskStatus.pending && task.dueAt >= new Date();

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.completed,
        completedById: scope.userId,
        completedAt: new Date(),
        ...(input.photoDataUrl ? { proofPhotoUrl: input.photoDataUrl } : {}),
      },
      include: taskInclude,
    });

    if (completedOnTime) {
      await this.harmony.applyOnTimeCompletion(scope.householdId);
    }

    if (task.kind === TaskKind.routine && task.cadence !== TaskCadence.once) {
      await this.spawnNextOccurrence(scope, task);
    }

    return updated;
  }

  private async spawnNextOccurrence(
    scope: HouseholdScope,
    task: {
      title: string;
      weight: TaskWeight;
      cadence: TaskCadence;
      dueAt: Date;
    },
  ) {
    const nextDueAt = nextRecurrenceDueAt(task.dueAt, task.cadence, new Date());
    const decision = await this.rotation.pickAssignee(
      scope.householdId,
      task.title,
      task.weight,
      {
        excludeUserId: scope.userId,
        excludeReason: 'they just completed this recurring chore',
      },
    );

    await this.prisma.task.create({
      data: {
        householdId: scope.householdId,
        title: task.title,
        titleSlug: normalizeChoreTitle(task.title),
        weight: task.weight,
        kind: TaskKind.routine,
        cadence: task.cadence,
        dueAt: nextDueAt,
        assigneeId: decision.userId,
        rotationReason: decision.reason,
      },
    });
  }

  async remove(scope: HouseholdScope, taskId: string) {
    const task = await this.findTaskInHousehold(taskId, scope.householdId);
    if (!taskPolicy.canDelete(scope, task)) throw new ForbiddenException();
    await this.prisma.task.delete({ where: { id: taskId } });
  }

  async update(scope: HouseholdScope, taskId: string, input: UpdateTaskInput) {
    const task = await this.findTaskInHousehold(taskId, scope.householdId);
    if (!taskPolicy.canEdit(scope, task)) throw new ForbiddenException();
    if (task.status === TaskStatus.completed) {
      throw new BadRequestException('Cannot edit a completed task');
    }

    if (input.assigneeId) {
      const member = await this.prisma.householdMember.findFirst({
        where: {
          userId: input.assigneeId,
          householdId: scope.householdId,
          status: 'active',
        },
        select: { id: true },
      });
      if (!member) {
        throw new BadRequestException('Assignee must be an active household member');
      }
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(input.title !== undefined
          ? { title: input.title, titleSlug: normalizeChoreTitle(input.title) }
          : {}),
        ...(input.weight !== undefined ? { weight: input.weight as TaskWeight } : {}),
        ...(input.dueAt !== undefined ? { dueAt: new Date(input.dueAt) } : {}),
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      },
      include: taskInclude,
    });
  }

  async reassign(scope: HouseholdScope, taskId: string) {
    const task = await this.findTaskInHousehold(taskId, scope.householdId);
    if (!taskPolicy.canReassign(scope, task)) throw new ForbiddenException();
    const decision = await this.rotation.pickAssignee(
      scope.householdId,
      task.title,
      task.weight,
    );
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        assigneeId: decision.userId,
        rotationReason: decision.reason,
      },
      include: taskInclude,
    });
  }

  private async findTaskInHousehold(taskId: string, householdId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, householdId },
      select: {
        id: true,
        title: true,
        assigneeId: true,
        flaggedById: true,
        householdId: true,
        status: true,
        dueAt: true,
        weight: true,
        kind: true,
        cadence: true,
        snoozeUsed: true,
        caretakerOwned: true,
      },
    });
    if (!task) throw new NotFoundException();
    return task;
  }

  async snooze(scope: HouseholdScope, taskId: string) {
    const task = await this.findTaskInHousehold(taskId, scope.householdId);
    if (!taskPolicy.canEdit(scope, task)) throw new ForbiddenException();
    if (task.status === TaskStatus.completed) {
      throw new BadRequestException('Cannot snooze a completed task');
    }
    if (task.snoozeUsed) {
      throw new BadRequestException('Task has already been snoozed once');
    }

    const nextDueAt = new Date(task.dueAt.getTime() + SNOOZE_HOURS * MS_PER_HOUR);
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        dueAt: nextDueAt,
        snoozeUsed: true,
        status: TaskStatus.pending,
      },
      include: taskInclude,
    });
  }

  private async sweepOverdue(householdId: string) {
    const now = new Date();
    const graceCutoff = new Date(now.getTime() - OVERDUE_GRACE_HOURS * MS_PER_HOUR);

    await this.prisma.task.updateMany({
      where: {
        householdId,
        status: TaskStatus.pending,
        dueAt: { lt: now },
      },
      data: { status: TaskStatus.overdue },
    });

    const toPenalize = await this.prisma.task.findMany({
      where: {
        householdId,
        status: TaskStatus.overdue,
        penaltyApplied: false,
        dueAt: { lt: graceCutoff },
      },
      select: { id: true },
    });
    if (toPenalize.length === 0) return;

    const ids = toPenalize.map((t) => t.id);
    await this.prisma.task.updateMany({
      where: { id: { in: ids } },
      data: { penaltyApplied: true },
    });
    await this.harmony.applyOverduePenalty(householdId, ids);
  }
}
