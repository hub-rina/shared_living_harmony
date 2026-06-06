import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TaskKind, TaskWeight } from '@prisma/client';
import {
  DEFAULT_SUPPLIES,
  normalizeChoreTitle,
  purchaseTaskTitle,
  type AddSupplyInput,
  type HouseholdScope,
} from '@homebuddy/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SmartRotationService } from '../tasks/smart-rotation.service';

const PURCHASE_DUE_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class SuppliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rotation: SmartRotationService,
  ) {}

  private assertActiveMember(scope: HouseholdScope) {
    if (scope.membership?.status !== 'active') throw new ForbiddenException();
  }

  list(scope: HouseholdScope) {
    return this.prisma.supply.findMany({
      where: { householdId: scope.householdId },
      orderBy: { name: 'asc' },
    });
  }

  add(scope: HouseholdScope, input: AddSupplyInput) {
    this.assertActiveMember(scope);
    return this.prisma.supply.upsert({
      where: { householdId_name: { householdId: scope.householdId, name: input.name } },
      update: {},
      create: { householdId: scope.householdId, name: input.name },
    });
  }

  async addDefaults(scope: HouseholdScope) {
    this.assertActiveMember(scope);
    await this.prisma.supply.createMany({
      data: DEFAULT_SUPPLIES.map((name) => ({ householdId: scope.householdId, name })),
      skipDuplicates: true,
    });
    return this.list(scope);
  }

  async markLow(scope: HouseholdScope, supplyId: string) {
    this.assertActiveMember(scope);
    const supply = await this.findInHousehold(scope, supplyId);

    const title = purchaseTaskTitle(supply.name);
    const decision = await this.rotation.pickAssignee(
      scope.householdId,
      title,
      TaskWeight.light,
    );

    const [updated, task] = await this.prisma.$transaction([
      this.prisma.supply.update({ where: { id: supply.id }, data: { isLow: true } }),
      this.prisma.task.create({
        data: {
          householdId: scope.householdId,
          title,
          titleSlug: normalizeChoreTitle(title),
          weight: TaskWeight.light,
          kind: TaskKind.reactive,
          dueAt: new Date(Date.now() + PURCHASE_DUE_DAYS * MS_PER_DAY),
          assigneeId: decision.userId,
          rotationReason: decision.reason,
        },
      }),
    ]);

    return { supply: updated, task };
  }

  async restock(scope: HouseholdScope, supplyId: string) {
    this.assertActiveMember(scope);
    const supply = await this.findInHousehold(scope, supplyId);
    return this.prisma.supply.update({ where: { id: supply.id }, data: { isLow: false } });
  }

  async remove(scope: HouseholdScope, supplyId: string) {
    this.assertActiveMember(scope);
    const supply = await this.findInHousehold(scope, supplyId);
    await this.prisma.supply.delete({ where: { id: supply.id } });
  }

  private async findInHousehold(scope: HouseholdScope, supplyId: string) {
    const supply = await this.prisma.supply.findFirst({
      where: { id: supplyId, householdId: scope.householdId },
    });
    if (!supply) throw new NotFoundException();
    return supply;
  }
}
