import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import {
  computeChurnRisk,
  explainChurnRisk,
  type LandlordMode,
  type MaintenanceRequest,
  type PropertyInsights,
  type PropertyMetrics,
} from '@homebuddy/shared';
import { PrismaService } from '../prisma/prisma.service';

const INSIGHT_DAYS_WINDOW = 30;
const INSIGHT_TASK_LIMIT = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Landlords manage property health, not people. Everything this service returns is
// aggregate-only — no tenant names, no per-person fault metrics. See docs/PRIVACY.md.
export interface PropertyDetail {
  propertyId: string;
  householdId: string;
  name: string;
  healthScore: number;
  churnRisk: 'low' | 'medium' | 'high';
  overdueCount: number;
  memberCount: number;
  activeCount: number;
  inactiveCount: number;
  mode: LandlordMode;
  linkedAt: string;
}

@Injectable()
export class LandlordService {
  constructor(private readonly prisma: PrismaService) {}

  async listProperties(landlordId: string): Promise<PropertyMetrics[]> {
    const links = await this.prisma.landlordProperty.findMany({
      where: { landlordId, consentGranted: true },
      include: {
        household: {
          include: {
            _count: {
              select: {
                members: true,
                tasks: { where: { status: TaskStatus.overdue } },
              },
            },
          },
        },
      },
      orderBy: { linkedAt: 'asc' },
    });

    return links.map((link) => {
      const { household } = link;
      const overdueCount = household._count.tasks;
      const memberCount = household._count.members;

      return {
        householdId: household.id,
        name: household.name,
        healthScore: household.harmonyScore,
        churnRisk: computeChurnRisk(household.harmonyScore, overdueCount),
        overdueCount,
        memberCount,
        mode: link.mode,
        linkedAt: link.linkedAt.toISOString(),
      };
    });
  }

  async getPropertyDetail(landlordUserId: string, propertyId: string): Promise<PropertyDetail> {
    const link = await this.prisma.landlordProperty.findFirst({
      where: { id: propertyId, landlordId: landlordUserId, consentGranted: true },
      include: {
        household: {
          include: {
            members: { select: { status: true } },
            _count: {
              select: {
                tasks: { where: { status: TaskStatus.overdue } },
              },
            },
          },
        },
      },
    });

    if (!link) throw new NotFoundException();

    const { household } = link;
    const activeCount = household.members.filter((m) => m.status === 'active').length;

    return {
      propertyId: link.id,
      householdId: household.id,
      name: household.name,
      healthScore: household.harmonyScore,
      churnRisk: computeChurnRisk(household.harmonyScore, household._count.tasks),
      overdueCount: household._count.tasks,
      memberCount: household.members.length,
      activeCount,
      inactiveCount: household.members.length - activeCount,
      mode: link.mode,
      linkedAt: link.linkedAt.toISOString(),
    };
  }

  async getPropertyInsights(
    landlordUserId: string,
    propertyId: string,
  ): Promise<PropertyInsights> {
    const link = await this.prisma.landlordProperty.findFirst({
      where: { id: propertyId, landlordId: landlordUserId, consentGranted: true },
      select: {
        id: true,
        household: {
          select: {
            id: true,
            harmonyScore: true,
          },
        },
      },
    });
    if (!link) throw new NotFoundException();

    const householdId = link.household.id;
    const now = new Date();
    const windowStart = new Date(now.getTime() - INSIGHT_DAYS_WINDOW * MS_PER_DAY);

    const [overdueRows, members, completed, recentMessFlagCount, overdueCount] =
      await Promise.all([
        this.prisma.task.findMany({
          where: { householdId, status: TaskStatus.overdue },
          orderBy: { dueAt: 'asc' },
          take: INSIGHT_TASK_LIMIT,
          select: { id: true, title: true, dueAt: true },
        }),
        this.prisma.householdMember.findMany({
          where: { householdId, status: 'active' },
          select: { user: { select: { id: true } } },
        }),
        this.prisma.task.findMany({
          where: {
            householdId,
            status: TaskStatus.completed,
            completedAt: { gte: windowStart },
            completedById: { not: null },
          },
          select: { completedById: true },
        }),
        this.prisma.messFlag.count({
          where: { householdId, createdAt: { gte: windowStart } },
        }),
        this.prisma.task.count({
          where: { householdId, status: TaskStatus.overdue },
        }),
      ]);

    const contributors = new Set(completed.map((c) => c.completedById as string));
    const totalMembers = members.length;
    const activeContributors = members.filter((m) => contributors.has(m.user.id)).length;

    const explanation = explainChurnRisk(link.household.harmonyScore, overdueCount);

    return {
      propertyId: link.id,
      householdId,
      churnRisk: explanation.level,
      churnRiskFactors: explanation.factors,
      overdueTasks: overdueRows.map((t) => ({
        id: t.id,
        title: t.title,
        dueAt: t.dueAt.toISOString(),
        daysOverdue: Math.max(
          0,
          Math.floor((now.getTime() - t.dueAt.getTime()) / MS_PER_DAY),
        ),
      })),
      contributionBalance: {
        spread: activeContributors < totalMembers ? 'uneven' : 'even',
        activeContributors,
        totalMembers,
      },
      recentMessFlagCount,
    };
  }

  async getPropertyMaintenance(
    landlordUserId: string,
    propertyId: string,
  ): Promise<MaintenanceRequest[]> {
    const link = await this.prisma.landlordProperty.findFirst({
      where: { id: propertyId, landlordId: landlordUserId, consentGranted: true },
      select: { household: { select: { id: true } } },
    });
    if (!link) throw new NotFoundException();

    // Privacy Line: the landlord sees only requests residents explicitly
    // escalated, never the household's full maintenance log. See §5.8.
    const rows = await this.prisma.maintenanceRequest.findMany({
      where: { householdId: link.household.id, escalated: true },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    // Landlord-safe shape: no reporter identity.
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      status: row.status,
      escalated: row.escalated,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
}
