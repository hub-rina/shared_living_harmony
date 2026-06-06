import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MaintenanceStatus, type MaintenanceRequest as MaintenanceRow } from '@prisma/client';
import {
  type CreateMaintenanceInput,
  type HouseholdScope,
  type MaintenanceRequest,
} from '@homebuddy/shared';
import { PrismaService } from '../prisma/prisma.service';

function toResponse(row: MaintenanceRow): MaintenanceRequest {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    status: row.status,
    escalated: row.escalated,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  private assertActiveMember(scope: HouseholdScope) {
    if (scope.membership?.status !== 'active') throw new ForbiddenException();
  }

  async list(scope: HouseholdScope): Promise<MaintenanceRequest[]> {
    const rows = await this.prisma.maintenanceRequest.findMany({
      where: { householdId: scope.householdId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map(toResponse);
  }

  async create(scope: HouseholdScope, input: CreateMaintenanceInput): Promise<MaintenanceRequest> {
    this.assertActiveMember(scope);
    const row = await this.prisma.maintenanceRequest.create({
      data: {
        householdId: scope.householdId,
        reporterId: scope.userId,
        title: input.title,
        category: input.category ?? null,
      },
    });
    return toResponse(row);
  }

  async updateStatus(
    scope: HouseholdScope,
    id: string,
    status: MaintenanceStatus,
  ): Promise<MaintenanceRequest> {
    this.assertActiveMember(scope);
    await this.findInHousehold(scope, id);
    const row = await this.prisma.maintenanceRequest.update({ where: { id }, data: { status } });
    return toResponse(row);
  }

  async setEscalation(
    scope: HouseholdScope,
    id: string,
    escalated: boolean,
  ): Promise<MaintenanceRequest> {
    this.assertActiveMember(scope);
    await this.findInHousehold(scope, id);
    const row = await this.prisma.maintenanceRequest.update({ where: { id }, data: { escalated } });
    return toResponse(row);
  }

  async remove(scope: HouseholdScope, id: string): Promise<void> {
    this.assertActiveMember(scope);
    await this.findInHousehold(scope, id);
    await this.prisma.maintenanceRequest.delete({ where: { id } });
  }

  private async findInHousehold(scope: HouseholdScope, id: string) {
    const row = await this.prisma.maintenanceRequest.findFirst({
      where: { id, householdId: scope.householdId },
    });
    if (!row) throw new NotFoundException();
    return row;
  }
}
