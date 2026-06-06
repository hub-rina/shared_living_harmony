import type {
  AuthResponse,
  CompleteRitualResponse,
  CompleteTaskInput,
  CreateCaretakerTaskInput,
  CreateHouseholdInput,
  CreateRitualInput,
  CreateTaskInput,
  FlagMessInput,
  Household,
  JoinHouseholdInput,
  LoginInput,
  MeResponse,
  PropertyInsights,
  PropertyMetrics,
  RegisterInput,
  Ritual,
  SetInactiveInput,
  Task,
  UpdateTaskInput,
  UpdateLandlordLinkInput,
  Supply,
  AddSupplyInput,
  MaintenanceRequest,
  CreateMaintenanceInput,
  MaintenanceStatus,
  Expense,
  ExpenseListResponse,
  ReceiptDraft,
  CreateExpenseInput,
  UpdateExpenseInput,
} from '@homebuddy/shared';
import { authStore } from './auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = authStore.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;

  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(message, res.status, payload);
  }
  return payload as T;
}

export const apiClient = {
  register: (input: RegisterInput) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: input }),
  login: (input: LoginInput) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: input }),
  refresh: (refreshToken: string) =>
    request<AuthResponse>('/auth/refresh', { method: 'POST', body: { refreshToken } }),
  logout: () => request<void>('/auth/logout', { method: 'POST', auth: true }),
  me: () => request<MeResponse>('/auth/me', { auth: true }),

  households: {
    list: () => request<Household[]>('/households', { auth: true }),
    create: (input: CreateHouseholdInput) =>
      request<Household>('/households', { method: 'POST', body: input, auth: true }),
    join: (input: JoinHouseholdInput) =>
      request<Household>('/households/join', { method: 'POST', body: input, auth: true }),
    regenerateCode: (id: string) =>
      request<{ joinCode: string }>(`/h/${id}/join-code/regenerate`, { method: 'POST', auth: true }),
    get: (id: string) => request<Household>(`/h/${id}`, { auth: true }),
    getScope: (id: string) =>
      request<{ scope: { householdId: string; userId: string; systemRole: 'user' | 'support'; membership?: { id: string; role: 'admin' | 'member'; status: 'active' | 'inactive' | 'invited' }; landlord?: { propertyId: string } } }>(`/h/${id}/me`, { auth: true }),
    setSelfInactive: (id: string, input: SetInactiveInput) =>
      request(`/h/${id}/membership/inactive`, { method: 'POST', body: input, auth: true }),
    endOwnInactive: (id: string) =>
      request(`/h/${id}/membership/active`, { method: 'POST', auth: true }),
    forceEndOther: (id: string, memberId: string) =>
      request(`/h/${id}/members/${memberId}/end-inactive`, { method: 'POST', auth: true }),
    updateLandlord: (id: string, landlordUserId: string, input: UpdateLandlordLinkInput) =>
      request(`/h/${id}/landlord/${landlordUserId}`, { method: 'PATCH', body: input, auth: true }),
  },

  tasks: {
    listForHousehold: (householdId: string) =>
      request<Task[]>(`/h/${householdId}/tasks`, { auth: true }),
    mine: (householdId: string) =>
      request<Task[]>(`/h/${householdId}/tasks/mine`, { auth: true }),
    create: (householdId: string, input: CreateTaskInput) =>
      request<Task>(`/h/${householdId}/tasks`, { method: 'POST', body: input, auth: true }),
    createCaretakerChore: (householdId: string, input: CreateCaretakerTaskInput) =>
      request<Task>(`/h/${householdId}/tasks/caretaker`, { method: 'POST', body: input, auth: true }),
    flagMess: (householdId: string, input: FlagMessInput) =>
      request<Task>(`/h/${householdId}/tasks/flag-mess`, { method: 'POST', body: input, auth: true }),
    complete: (householdId: string, taskId: string, input: CompleteTaskInput = {}) =>
      request<Task>(`/h/${householdId}/tasks/${taskId}/complete`, { method: 'POST', body: input, auth: true }),
    update: (householdId: string, taskId: string, input: UpdateTaskInput) =>
      request<Task>(`/h/${householdId}/tasks/${taskId}`, { method: 'PATCH', body: input, auth: true }),
    snooze: (householdId: string, taskId: string) =>
      request<Task>(`/h/${householdId}/tasks/${taskId}/snooze`, { method: 'POST', auth: true }),
    remove: (householdId: string, taskId: string) =>
      request<void>(`/h/${householdId}/tasks/${taskId}`, { method: 'DELETE', auth: true }),
  },

  rituals: {
    listForHousehold: (householdId: string) =>
      request<Ritual[]>(`/h/${householdId}/rituals`, { auth: true }),
    create: (householdId: string, input: CreateRitualInput) =>
      request<Ritual>(`/h/${householdId}/rituals`, { method: 'POST', body: input, auth: true }),
    join: (householdId: string, ritualId: string) =>
      request<Ritual>(`/h/${householdId}/rituals/${ritualId}/join`, { method: 'POST', auth: true }),
    complete: (householdId: string, ritualId: string) =>
      request<CompleteRitualResponse>(`/h/${householdId}/rituals/${ritualId}/complete`, { method: 'POST', auth: true }),
  },

  supplies: {
    list: (householdId: string) =>
      request<Supply[]>(`/h/${householdId}/supplies`, { auth: true }),
    add: (householdId: string, input: AddSupplyInput) =>
      request<Supply>(`/h/${householdId}/supplies`, { method: 'POST', body: input, auth: true }),
    addDefaults: (householdId: string) =>
      request<Supply[]>(`/h/${householdId}/supplies/defaults`, { method: 'POST', auth: true }),
    markLow: (householdId: string, supplyId: string) =>
      request<{ supply: Supply }>(`/h/${householdId}/supplies/${supplyId}/low`, {
        method: 'POST',
        auth: true,
      }),
    restock: (householdId: string, supplyId: string) =>
      request<Supply>(`/h/${householdId}/supplies/${supplyId}/restock`, {
        method: 'POST',
        auth: true,
      }),
    remove: (householdId: string, supplyId: string) =>
      request<void>(`/h/${householdId}/supplies/${supplyId}`, { method: 'DELETE', auth: true }),
  },

  maintenance: {
    list: (householdId: string) =>
      request<MaintenanceRequest[]>(`/h/${householdId}/maintenance`, { auth: true }),
    create: (householdId: string, input: CreateMaintenanceInput) =>
      request<MaintenanceRequest>(`/h/${householdId}/maintenance`, {
        method: 'POST',
        body: input,
        auth: true,
      }),
    setStatus: (householdId: string, id: string, status: MaintenanceStatus) =>
      request<MaintenanceRequest>(`/h/${householdId}/maintenance/${id}/status`, {
        method: 'PATCH',
        body: { status },
        auth: true,
      }),
    setEscalation: (householdId: string, id: string, escalated: boolean) =>
      request<MaintenanceRequest>(`/h/${householdId}/maintenance/${id}/escalation`, {
        method: 'PATCH',
        body: { escalated },
        auth: true,
      }),
    remove: (householdId: string, id: string) =>
      request<void>(`/h/${householdId}/maintenance/${id}`, { method: 'DELETE', auth: true }),
  },

  expenses: {
    list: (householdId: string) =>
      request<ExpenseListResponse>(`/h/${householdId}/expenses`, { auth: true }),
    scan: (householdId: string, imageDataUrl: string) =>
      request<ReceiptDraft>(`/h/${householdId}/expenses/scan`, {
        method: 'POST',
        body: { imageDataUrl },
        auth: true,
      }),
    create: (householdId: string, input: CreateExpenseInput) =>
      request<Expense>(`/h/${householdId}/expenses`, { method: 'POST', body: input, auth: true }),
    update: (householdId: string, id: string, input: UpdateExpenseInput) =>
      request<Expense>(`/h/${householdId}/expenses/${id}`, {
        method: 'PATCH',
        body: input,
        auth: true,
      }),
    remove: (householdId: string, id: string) =>
      request<void>(`/h/${householdId}/expenses/${id}`, { method: 'DELETE', auth: true }),
    markPaid: (householdId: string, id: string, shareId: string, proofImageDataUrl?: string) =>
      request<Expense>(`/h/${householdId}/expenses/${id}/shares/${shareId}/paid`, {
        method: 'POST',
        body: proofImageDataUrl ? { proofImageDataUrl } : {},
        auth: true,
      }),
    confirm: (householdId: string, id: string, shareId: string) =>
      request<Expense>(`/h/${householdId}/expenses/${id}/shares/${shareId}/confirm`, {
        method: 'POST',
        auth: true,
      }),
  },

  properties: {
    list: () => request<PropertyMetrics[]>('/properties', { auth: true }),
    get: (propertyId: string) => request<PropertyMetrics>(`/properties/${propertyId}`, { auth: true }),
    insights: (propertyId: string) =>
      request<PropertyInsights>(`/properties/${propertyId}/insights`, { auth: true }),
    maintenance: (propertyId: string) =>
      request<MaintenanceRequest[]>(`/properties/${propertyId}/maintenance`, { auth: true }),
  },
};
