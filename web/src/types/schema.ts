export interface ValueEnumItem {
  text: string;
  [key: string]: unknown;
}

export type ValueEnum = Record<string, ValueEnumItem>;

export interface FormItemRule {
  required?: boolean;
  message?: string;
  max?: number;
  min?: number;
  len?: number;
  pattern?: string;
  /** 仅前端注入的运行时能力 */
  type?: 'number' | 'string';
  transform?: (value: unknown) => unknown;
}

export interface FormItemProps {
  rules?: FormItemRule[];
  tooltip?: string;
  extra?: string;
}

export interface ColProps {
  span?: number;
  xs?: number | Record<string, unknown>;
  sm?: number | Record<string, unknown>;
  md?: number | Record<string, unknown>;
  lg?: number | Record<string, unknown>;
}

export interface ColumnSchema {
  dataIndex: string;
  title?: string;
  valueType: string;
  valueEnum?: ValueEnum;
  formItemProps?: FormItemProps;
  fieldProps?: Record<string, unknown>;
  hideInTable?: boolean;
  hideInSearch?: boolean;
  hideInForm?: boolean;
  tooltip?: string;
  width?: number;
  initialValue?: unknown;
  colProps?: ColProps;
  columns?: ColumnSchema[];
  /** 运行时注入，不落库 */
  render?: unknown;
  renderFormItem?: unknown;
  _uid?: string;
}

export interface FormSchema {
  formKey: string;
  title: string;
  description?: string;
  columns: ColumnSchema[];
}

export interface ComponentMeta {
  valueType: string;
  label: string;
  custom: boolean;
  frontendRenderer: string | null;
  requiresValueEnum: boolean;
  layout: boolean;
  childrenPolicy: 'forbidden' | 'required';
  allowedFieldProps: string[] | null;
}

export interface SchemaVersion {
  id: number;
  formKey: string;
  title: string;
  version: number;
  status: string;
  createdAt: string;
  schema: FormSchema;
}

export interface FormRecord {
  id: number;
  formKey: string;
  schemaVersion: number;
  data: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecordDetail {
  record: FormRecord;
  schemaVersion: number;
}

export interface PageResult<T> {
  data: T[];
  total: number;
  current: number;
  pageSize: number;
}

export type ChatIntent = 'generate' | 'modify' | 'review' | 'sample_data' | 'action' | 'reply';

export interface ProposedAction {
  type: 'delete' | 'publish' | 'rollback' | 'export';
  formKey: string;
  version?: number;
}

export interface ChatResponse {
  intent: ChatIntent;
  reply: string;
  schema?: FormSchema;
  action?: ProposedAction;
  sampleData?: Record<string, unknown>[];
  suggestions?: string[];
  warnings?: string[];
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent?: ChatIntent;
  schema?: FormSchema;
  proposedSchema?: FormSchema;
  action?: ProposedAction;
  sampleData?: Record<string, unknown>[];
  suggestions?: string[];
  warnings?: string[];
  diffSummary?: string;
  streaming?: boolean;
  error?: boolean;
  createdAt?: string;
}

export interface ChatSession {
  sessionKey: string;
  messages: ChatMessage[];
  schemaJson: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type MappingType =
  | 'string'
  | 'long'
  | 'double'
  | 'decimal'
  | 'boolean'
  | 'datetime'
  | 'enum'
  | 'array'
  | 'const';

export interface MappingItem {
  from?: string | null;
  to: string;
  type: MappingType;
  enumMap?: Record<string, string> | null;
  enumDefault?: string | null;
  scale?: number | null;
  format?: string | null;
  value?: unknown;
  itemMappings?: MappingItem[] | null;
}

export interface ViewConfig {
  viewKey: string;
  title: string;
  formKey: string;
  description?: string | null;
  mappings: MappingItem[];
}

export interface ViewVersion {
  id: number;
  viewKey: string;
  version: number;
  formKey: string;
  title: string;
  description?: string | null;
  mapping: ViewConfig;
  createdAt: string;
  updatedAt: string;
  warnings?: string[];
}

export interface ViewTestResult {
  transformed: Record<string, unknown>;
  warnings: string[];
  input: Record<string, unknown>;
}

export interface GeneratedSchemaResult {
  schema: FormSchema;
  warnings: string[];
}

export interface GeneratedViewResult {
  mapping: ViewConfig;
  warnings: string[];
}

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
}
