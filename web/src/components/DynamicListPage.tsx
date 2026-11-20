import { DownloadOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, DatePicker, Input, Result, Space, Spin, Typography, message } from 'antd';
import type { Dayjs } from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteRecord,
  exportUrl,
  getFormSchema,
  listRecords,
  type ApiError,
} from '@/services/api';
import type { FormSchema } from '@/types/schema';
import { flattenRecord, pickSchemaData } from '@/utils/formValues';
import { hydrateColumns } from '@/utils/hydrateColumns';
import { validateSchema } from '@/utils/validateSchema';
import { DynamicFormDrawer, type FormDrawerMode } from './DynamicFormDrawer';
import { RecordDetailDrawer } from './RecordDetailDrawer';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const RESERVED_PARAMS = new Set([
  'current',
  'pageSize',
  'keyword',
  'startTime',
  'endTime',
  'sorter',
  'filter',
  '__timeStart',
  '__timeEnd',
]);

function buildFilters(params: Record<string, unknown>): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  Object.entries(params || {}).forEach(([key, value]) => {
    if (RESERVED_PARAMS.has(key)) return;
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value) && value.length === 0) return;
    filters[key] = value;
  });
  return filters;
}

interface DrawerState {
  open: boolean;
  mode: FormDrawerMode;
  data: Record<string, unknown> | null;
  recordId?: number;
}

export function DynamicListPage({ formKey }: { formKey: string }) {
  const actionRef = useRef<ActionType>();
  const lastFilters = useRef<Record<string, unknown>>({});

  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [timeRange, setTimeRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, mode: 'create', data: null });
  const [detail, setDetail] = useState<{ open: boolean; recordId?: number }>({ open: false });

  const loadSchema = useCallback(() => {
    setLoading(true);
    setLoadError('');
    setValidationErrors([]);
    getFormSchema(formKey)
      .then((data) => {
        const check = validateSchema(data.schema);
        if (!check.ok) {
          setValidationErrors(check.errors);
          return;
        }
        setSchema(data.schema);
      })
      .catch((err: ApiError) => setLoadError(err.message || '加载 Schema 失败'))
      .finally(() => setLoading(false));
  }, [formKey]);

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  const handleDelete = useCallback(
    async (record: Record<string, unknown>) => {
      try {
        await deleteRecord(formKey, Number(record.id));
        message.success('删除成功');
        actionRef.current?.reload();
      } catch {
        // API 层已提示
      }
    },
    [formKey],
  );

  const columns = useMemo<ProColumns<Record<string, unknown>>[]>(() => {
    if (!schema) return [];
    return hydrateColumns(schema.columns, {
      mode: 'table',
      onDetail: (record) => setDetail({ open: true, recordId: Number(record.id) }),
      onEdit: (record) =>
        setDrawer({
          open: true,
          mode: 'edit',
          data: pickSchemaData(schema, record),
          recordId: Number(record.id),
        }),
      onDelete: handleDelete,
    });
  }, [schema, handleDelete]);

  const handleExport = () => {
    const filters = lastFilters.current;
    const url = exportUrl(formKey, {
      keyword: keyword || undefined,
      startTime: timeRange?.[0]?.toISOString(),
      endTime: timeRange?.[1]?.toISOString(),
      filters: Object.keys(filters).length ? JSON.stringify(filters) : undefined,
    });
    window.open(url, '_blank', 'noopener');
  };

  if (loading) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin tip="正在加载表单…" />
      </div>
    );
  }

  if (loadError || validationErrors.length) {
    return (
      <Result
        status={loadError ? 'error' : 'warning'}
        title={loadError ? '表单加载失败' : 'Schema 校验未通过'}
        subTitle={loadError || validationErrors.join('；')}
        extra={
          <Button type="primary" icon={<ReloadOutlined />} onClick={loadSchema}>
            重试
          </Button>
        }
      />
    );
  }

  if (!schema) return null;

  return (
    <div style={{ padding: '24px 32px' }}>
      <ProTable<Record<string, unknown>>
        actionRef={actionRef}
        rowKey="id"
        headerTitle={
          <Space direction="vertical" size={0}>
            <Text strong style={{ fontSize: 18 }}>
              {schema.title}
            </Text>
            {schema.description ? <Text type="secondary">{schema.description}</Text> : null}
            <Text type="secondary" style={{ fontSize: 12 }}>
              formKey: {formKey}
            </Text>
          </Space>
        }
        columns={columns}
        search={{ labelWidth: 'auto' }}
        options={false}
        scroll={{ x: 'max-content' }}
        dateFormatter="string"
        params={{
          keyword,
          __timeStart: timeRange?.[0]?.valueOf(),
          __timeEnd: timeRange?.[1]?.valueOf(),
        }}
        request={async (params) => {
          const filters = buildFilters(params);
          lastFilters.current = filters;
          try {
            const result = await listRecords(formKey, {
              current: params.current,
              pageSize: params.pageSize,
              keyword: keyword || undefined,
              startTime: timeRange?.[0]?.toISOString(),
              endTime: timeRange?.[1]?.toISOString(),
              filters: Object.keys(filters).length ? JSON.stringify(filters) : undefined,
            });
            return {
              data: result.data.map(flattenRecord),
              total: result.total,
              success: true,
            };
          } catch {
            return { data: [], total: 0, success: false };
          }
        }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        toolBarRender={() => [
          <Input.Search
            key="keyword"
            placeholder="关键词搜索（≥3 字命中索引）"
            allowClear
            style={{ width: 260 }}
            onSearch={(value) => setKeyword(value.trim())}
          />,
          <RangePicker
            key="range"
            showTime
            value={timeRange}
            onChange={(value) => setTimeRange(value as [Dayjs, Dayjs] | null)}
          />,
          <Button key="export" icon={<DownloadOutlined />} onClick={handleExport}>
            导出 CSV
          </Button>,
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setDrawer({ open: true, mode: 'create', data: null })}
          >
            新增
          </Button>,
        ]}
      />

      <DynamicFormDrawer
        open={drawer.open}
        mode={drawer.mode}
        formKey={formKey}
        schema={schema}
        data={drawer.data}
        recordId={drawer.recordId}
        onClose={() => setDrawer((prev) => ({ ...prev, open: false }))}
        onSuccess={() => actionRef.current?.reload()}
      />

      <RecordDetailDrawer
        open={detail.open}
        formKey={formKey}
        recordId={detail.recordId}
        onClose={() => setDetail({ open: false })}
      />
    </div>
  );
}
