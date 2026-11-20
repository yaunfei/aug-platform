import { message as antdMessage } from 'antd';
import type {
  ChatMessage,
  ChatResponse,
  ChatSession,
  ComponentMeta,
  FormRecord,
  FormSchema,
  GeneratedSchemaResult,
  GeneratedViewResult,
  PageResult,
  RecordDetail,
  SchemaVersion,
  UploadResult,
  ViewConfig,
  ViewTestResult,
  ViewVersion,
} from '@/types/schema';

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  total?: number;
  current?: number;
  pageSize?: number;
  errorCode?: string;
  errorMessage?: string;
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function getToken(): string {
  try {
    return localStorage.getItem('apiToken') || '';
  } catch {
    return '';
  }
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  silent = false,
): Promise<ApiEnvelope<T>> {
  const headers = authHeaders({
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers as Record<string, string> | undefined),
  });
  let resp: Response;
  try {
    resp = await fetch(path, { ...init, headers });
  } catch (err) {
    if (!silent) antdMessage.error('网络异常，请检查后端服务是否已启动');
    throw new ApiError('NETWORK_ERROR', (err as Error).message || '网络异常');
  }
  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await resp.json()) as ApiEnvelope<T>;
  } catch {
    body = null;
  }
  if (!body || body.success !== true) {
    const error = new ApiError(
      body?.errorCode || `HTTP_${resp.status}`,
      body?.errorMessage || `请求失败（HTTP ${resp.status}）`,
      resp.status,
    );
    if (!silent) antdMessage.error(error.message);
    throw error;
  }
  return body;
}

export async function call<T>(
  path: string,
  init: RequestInit = {},
  options: { silent?: boolean } = {},
): Promise<T> {
  const body = await request<T>(path, init, options.silent);
  return body.data as T;
}

export async function callPage<T>(
  path: string,
  init: RequestInit = {},
  options: { silent?: boolean } = {},
): Promise<PageResult<T>> {
  const body = await request<T[]>(path, init, options.silent);
  return {
    data: (body.data || []) as T[],
    total: body.total || 0,
    current: body.current || 1,
    pageSize: body.pageSize || 20,
  };
}

function qs(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

// ---------------- Schema ----------------
export function fetchComponents(): Promise<ComponentMeta[]> {
  return call<{ components: ComponentMeta[] }>('/api/schema/components').then(
    (data) => data.components,
  );
}

export function listSchemas(params: {
  formKey?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
} = {}): Promise<SchemaVersion[]> {
  return call<SchemaVersion[]>(`/api/schema${qs(params)}`);
}

export function publishSchema(formKey: string, schema: FormSchema): Promise<SchemaVersion> {
  return call<SchemaVersion>(`/api/schema/${encodeURIComponent(formKey)}/publish`, {
    method: 'POST',
    body: JSON.stringify(schema),
  });
}

export function listSchemaVersions(formKey: string): Promise<SchemaVersion[]> {
  return call<SchemaVersion[]>(`/api/schema/${encodeURIComponent(formKey)}/versions`);
}

export function rollbackSchema(formKey: string, version: number): Promise<SchemaVersion> {
  return call<SchemaVersion>(`/api/schema/${encodeURIComponent(formKey)}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  });
}

export function deleteSchema(formKey: string): Promise<{ deleted: boolean }> {
  return call<{ deleted: boolean }>(`/api/schema/${encodeURIComponent(formKey)}`, {
    method: 'DELETE',
  });
}

export function generateSchema(prdText: string, formKeyHint?: string): Promise<GeneratedSchemaResult> {
  return call<GeneratedSchemaResult>('/api/schema/generate', {
    method: 'POST',
    body: JSON.stringify({ prdText, formKeyHint }),
  });
}

export function getFormSchema(formKey: string, version?: number): Promise<SchemaVersion> {
  return call<SchemaVersion>(`/api/form/${encodeURIComponent(formKey)}/schema${qs({ version })}`);
}

// ---------------- Records ----------------
export function submitRecord(
  formKey: string,
  data: Record<string, unknown>,
): Promise<FormRecord> {
  return call<FormRecord>(`/api/form/${encodeURIComponent(formKey)}/submit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function listRecords(
  formKey: string,
  params: {
    current?: number;
    pageSize?: number;
    startTime?: string;
    endTime?: string;
    keyword?: string;
    filters?: string;
  } = {},
): Promise<PageResult<FormRecord>> {
  return callPage<FormRecord>(`/api/form/${encodeURIComponent(formKey)}/records${qs(params)}`);
}

export function getRecordDetail(formKey: string, recordId: number): Promise<RecordDetail> {
  return call<RecordDetail>(
    `/api/form/${encodeURIComponent(formKey)}/records/${encodeURIComponent(String(recordId))}`,
  );
}

export function updateRecord(
  formKey: string,
  recordId: number,
  data: Record<string, unknown>,
): Promise<FormRecord> {
  return call<FormRecord>(
    `/api/form/${encodeURIComponent(formKey)}/records/${encodeURIComponent(String(recordId))}`,
    { method: 'PUT', body: JSON.stringify(data) },
  );
}

export function deleteRecord(formKey: string, recordId: number): Promise<{ deleted: boolean }> {
  return call<{ deleted: boolean }>(
    `/api/form/${encodeURIComponent(formKey)}/records/${encodeURIComponent(String(recordId))}`,
    { method: 'DELETE' },
  );
}

export function exportUrl(
  formKey: string,
  params: {
    startTime?: string;
    endTime?: string;
    keyword?: string;
    filters?: string;
  } = {},
): string {
  return `/api/form/${encodeURIComponent(formKey)}/export${qs(params)}`;
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const resp = await fetch('/api/upload', {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  const body = (await resp.json().catch(() => null)) as ApiEnvelope<UploadResult> | null;
  if (!resp.ok || !body || body.success !== true) {
    const error = new ApiError(
      body?.errorCode || `HTTP_${resp.status}`,
      body?.errorMessage || '上传失败',
      resp.status,
    );
    antdMessage.error(error.message);
    throw error;
  }
  return body.data as UploadResult;
}

// ---------------- Assistant ----------------
export function chatAssistant(
  messages: ChatMessage[],
  currentSchema?: FormSchema | null,
): Promise<ChatResponse> {
  return call<ChatResponse>('/api/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, currentSchema: currentSchema || undefined }),
  });
}

export type StreamEvent =
  | { type: 'delta'; text?: string; content?: string }
  | { type: 'stage'; message?: string; text?: string }
  | { type: 'reset' }
  | { type: 'final'; data: ChatResponse }
  | { type: 'error'; errorCode?: string; message?: string };

export async function chatAssistantStream(
  messages: ChatMessage[],
  currentSchema: FormSchema | null | undefined,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const resp = await fetch('/api/assistant/chat/stream', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ messages, currentSchema: currentSchema || undefined }),
    signal,
  });
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const body = (await resp.json()) as ApiEnvelope<unknown>;
      detail = body.errorMessage || detail;
    } catch {
      // ignore
    }
    throw new ApiError(`HTTP_${resp.status}`, detail, resp.status);
  }
  if (!resp.body) throw new ApiError('SSE_UNAVAILABLE', '当前浏览器不支持流式响应');
  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf('\n\n');
    while (idx >= 0) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLines = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim());
      if (dataLines.length) {
        try {
          onEvent(JSON.parse(dataLines.join('\n')) as StreamEvent);
        } catch {
          // 非法帧忽略
        }
      }
      idx = buffer.indexOf('\n\n');
    }
  }
}

export function listChatSessions(): Promise<ChatSession[]> {
  return call<ChatSession[]>('/api/assistant/sessions');
}

export function getChatSession(sessionKey: string): Promise<ChatSession> {
  return call<ChatSession>(`/api/assistant/sessions/${encodeURIComponent(sessionKey)}`, undefined, {
    silent: true,
  });
}

export function saveChatSession(
  sessionKey: string,
  payload: { messages: ChatMessage[]; schemaJson: string },
): Promise<ChatSession> {
  return call<ChatSession>(
    `/api/assistant/sessions/${encodeURIComponent(sessionKey)}`,
    { method: 'PUT', body: JSON.stringify(payload) },
    { silent: true },
  );
}

export function deleteChatSession(sessionKey: string): Promise<{ deleted: boolean }> {
  return call<{ deleted: boolean }>(
    `/api/assistant/sessions/${encodeURIComponent(sessionKey)}`,
    { method: 'DELETE' },
    { silent: true },
  );
}

// ---------------- View mapping ----------------
export function generateViewMapping(
  docText: string,
  formKey: string,
): Promise<GeneratedViewResult> {
  return call<GeneratedViewResult>('/api/view/generate', {
    method: 'POST',
    body: JSON.stringify({ docText, formKey }),
  });
}

export function listViews(formKey?: string): Promise<ViewVersion[]> {
  return call<ViewVersion[]>(`/api/view${qs({ formKey })}`);
}

export function publishView(viewKey: string, mapping: ViewConfig): Promise<ViewVersion> {
  return call<ViewVersion>(`/api/view/${encodeURIComponent(viewKey)}/publish`, {
    method: 'POST',
    body: JSON.stringify(mapping),
  });
}

export function getViewConfig(viewKey: string): Promise<ViewVersion> {
  return call<ViewVersion>(`/api/view/${encodeURIComponent(viewKey)}`);
}

export function listViewVersions(viewKey: string): Promise<ViewVersion[]> {
  return call<ViewVersion[]>(`/api/view/${encodeURIComponent(viewKey)}/versions`);
}

export function rollbackView(viewKey: string, version: number): Promise<ViewVersion> {
  return call<ViewVersion>(`/api/view/${encodeURIComponent(viewKey)}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  });
}

export function deleteView(viewKey: string): Promise<{ deleted: boolean }> {
  return call<{ deleted: boolean }>(`/api/view/${encodeURIComponent(viewKey)}`, {
    method: 'DELETE',
  });
}

export function testView(
  viewKey: string,
  payload: { recordId?: number; sampleData?: Record<string, unknown> },
): Promise<ViewTestResult> {
  return call<ViewTestResult>(`/api/view/${encodeURIComponent(viewKey)}/test`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
