import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  expensePolicy,
  netBalances,
  parseReceiptText,
  splitBill,
  type CreateExpenseInput,
  type Expense,
  type ExpenseListResponse,
  type HouseholdScope,
  type ReceiptDraft,
  type UpdateExpenseInput,
} from '@homebuddy/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OcrService } from '../ocr/ocr.service';
import { StorageService } from '../storage/storage.service';

const expenseInclude = {
  creator: { select: { id: true, name: true } },
  items: { orderBy: { position: 'asc' } },
  shares: {
    include: { debtor: { select: { id: true, name: true } } },
    orderBy: { debtor: { name: 'asc' } },
  },
} satisfies Prisma.ExpenseInclude;

type ExpenseRow = Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>;

function toResponse(row: ExpenseRow): Expense {
  return {
    id: row.id,
    creatorId: row.creatorId,
    creatorName: row.creator.name,
    title: row.title,
    note: row.note,
    totalCents: row.totalCents,
    receiptUrl: row.receiptUrl,
    items: row.items.map((item) => ({
      id: item.id,
      label: item.label,
      amountCents: item.amountCents,
      position: item.position,
    })),
    shares: row.shares.map((share) => ({
      id: share.id,
      debtorId: share.debtorId,
      debtorName: share.debtor.name,
      amountCents: share.amountCents,
      status: share.status,
      proofUrl: share.proofUrl,
      paidAt: share.paidAt?.toISOString() ?? null,
      confirmedAt: share.confirmedAt?.toISOString() ?? null,
    })),
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ocr: OcrService,
  ) {}

  async scan(scope: HouseholdScope, imageDataUrl: string): Promise<ReceiptDraft> {
    if (!expensePolicy.canCreate(scope)) throw new ForbiddenException();
    const image = this.storage.decodeDataUrl(imageDataUrl);
    const [receiptUrl, text] = await Promise.all([
      this.storage.store(image, `receipts/${scope.householdId}`),
      this.ocr.read(image.buffer),
    ]);
    const { items, totalCents } = parseReceiptText(text);
    return { items, totalCents, receiptUrl };
  }

  async list(scope: HouseholdScope): Promise<ExpenseListResponse> {
    if (!expensePolicy.canViewList(scope)) throw new ForbiddenException();
    const rows = await this.prisma.expense.findMany({
      where: { householdId: scope.householdId },
      include: expenseInclude,
      orderBy: { createdAt: 'desc' },
    });
    const expenses = rows.map(toResponse);
    const balances = netBalances(
      expenses.map((e) => ({
        creatorId: e.creatorId,
        creatorName: e.creatorName,
        shares: e.shares.map((s) => ({
          debtorId: s.debtorId,
          debtorName: s.debtorName,
          amountCents: s.amountCents,
          status: s.status,
        })),
      })),
      scope.userId,
    );
    return { expenses, balances };
  }

  async create(scope: HouseholdScope, input: CreateExpenseInput): Promise<Expense> {
    if (!expensePolicy.canCreate(scope)) throw new ForbiddenException();
    const sharerIds = await this.resolveSharers(scope, input.includedMemberIds);
    const shares = splitBill(input.totalCents, sharerIds, scope.userId);

    const row = await this.prisma.expense.create({
      data: {
        householdId: scope.householdId,
        creatorId: scope.userId,
        title: input.title,
        note: input.note ?? null,
        totalCents: input.totalCents,
        receiptUrl: input.receiptUrl ?? null,
        items: {
          create: (input.items ?? []).map((item, position) => ({
            label: item.label,
            amountCents: item.amountCents,
            position,
          })),
        },
        shares: {
          create: shares.map((share) => ({
            debtorId: share.debtorId,
            amountCents: share.amountCents,
          })),
        },
      },
      include: expenseInclude,
    });
    return toResponse(row);
  }

  async update(scope: HouseholdScope, id: string, input: UpdateExpenseInput): Promise<Expense> {
    const existing = await this.findInHousehold(scope, id);
    if (!expensePolicy.canEdit(scope, existing)) throw new ForbiddenException();

    const recomputeSplit = input.totalCents !== undefined || input.includedMemberIds !== undefined;
    if (recomputeSplit && existing.shares.some((share) => share.status !== 'open')) {
      throw new BadRequestException(
        'Cannot change the amount or who is included once a share has been paid',
      );
    }

    const totalCents = input.totalCents ?? existing.totalCents;
    // When only the amount changes we keep the original sharers (the creator was
    // included by default alongside the existing debtors).
    const sharerIds = input.includedMemberIds
      ? await this.resolveSharers(scope, input.includedMemberIds)
      : [...existing.shares.map((share) => share.debtorId), existing.creatorId];

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.expense.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
          ...(input.totalCents !== undefined ? { totalCents } : {}),
        },
      });

      if (input.items !== undefined) {
        await tx.expenseItem.deleteMany({ where: { expenseId: id } });
        await tx.expenseItem.createMany({
          data: input.items.map((item, position) => ({
            expenseId: id,
            label: item.label,
            amountCents: item.amountCents,
            position,
          })),
        });
      }

      if (recomputeSplit) {
        await tx.expenseShare.deleteMany({ where: { expenseId: id } });
        await tx.expenseShare.createMany({
          data: splitBill(totalCents, sharerIds, existing.creatorId).map((share) => ({
            expenseId: id,
            debtorId: share.debtorId,
            amountCents: share.amountCents,
          })),
        });
      }

      return tx.expense.findUniqueOrThrow({ where: { id }, include: expenseInclude });
    });
    return toResponse(row);
  }

  async remove(scope: HouseholdScope, id: string): Promise<void> {
    const existing = await this.findInHousehold(scope, id);
    if (!expensePolicy.canDelete(scope, existing)) throw new ForbiddenException();
    await this.prisma.expense.delete({ where: { id } });
  }

  async markPaid(
    scope: HouseholdScope,
    id: string,
    shareId: string,
    proofImageDataUrl?: string,
  ): Promise<Expense> {
    await this.findInHousehold(scope, id);
    const share = await this.findShare(id, shareId);
    if (!expensePolicy.canMarkPaid(scope, share)) throw new ForbiddenException();
    if (share.status === 'confirmed') {
      throw new BadRequestException('This share is already settled');
    }

    const proofUrl = proofImageDataUrl
      ? await this.storage.store(
          this.storage.decodeDataUrl(proofImageDataUrl),
          `proofs/${scope.householdId}`,
        )
      : undefined;

    await this.prisma.expenseShare.update({
      where: { id: shareId },
      data: {
        status: 'paid',
        paidAt: new Date(),
        ...(proofUrl ? { proofUrl } : {}),
      },
    });
    return this.findInHousehold(scope, id).then(toResponse);
  }

  async confirm(scope: HouseholdScope, id: string, shareId: string): Promise<Expense> {
    const expense = await this.findInHousehold(scope, id);
    if (!expensePolicy.canConfirm(scope, expense)) throw new ForbiddenException();
    const share = await this.findShare(id, shareId);
    if (share.status !== 'paid') {
      throw new BadRequestException('Only a paid share can be confirmed');
    }
    await this.prisma.expenseShare.update({
      where: { id: shareId },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });
    return this.findInHousehold(scope, id).then(toResponse);
  }

  // Validates the people sharing a bill (creator may be among them) and returns
  // the unique set. There must be at least one person other than the creator,
  // otherwise nobody owes anything.
  private async resolveSharers(
    scope: HouseholdScope,
    requested: string[],
  ): Promise<string[]> {
    const sharerIds = [...new Set(requested)];
    if (sharerIds.filter((userId) => userId !== scope.userId).length === 0) {
      throw new BadRequestException('A bill needs at least one other person to split with');
    }
    const members = await this.prisma.householdMember.findMany({
      where: { householdId: scope.householdId, userId: { in: sharerIds } },
      select: { userId: true },
    });
    if (members.length !== sharerIds.length) {
      throw new BadRequestException('Everyone in a split must be a member of this house');
    }
    return sharerIds;
  }

  private async findInHousehold(scope: HouseholdScope, id: string): Promise<ExpenseRow> {
    const row = await this.prisma.expense.findFirst({
      where: { id, householdId: scope.householdId },
      include: expenseInclude,
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  private async findShare(expenseId: string, shareId: string) {
    const share = await this.prisma.expenseShare.findFirst({ where: { id: shareId, expenseId } });
    if (!share) throw new NotFoundException();
    return share;
  }
}
