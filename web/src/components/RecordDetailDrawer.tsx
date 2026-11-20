import { ProDescriptions } from '@ant-design/pro-components';
import { Alert, Drawer, Spin } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { getFormSchema, getRecordDetail } from '@/services/api';
import type { FormRecord, FormSchema } from '@/types/schema';
import { hydrateColumns } from '@/utils/hydrateColumns';
import { flattenRecord } from '@/utils/formValues';

interface Props {
  open: boolean;
  formKey: string;
  recordId?: number;
  onClose: () => void;
}

/** 按记录固化的 schemaVersion 拉历史 Schema 渲染，保证老数据字段改名/删除后仍正确展示。 */
export function RecordDetailDrawer({ open, formKey, recordId, onClose }: Props) {
  const [record, setRecord] = useState<FormRecord | null>(null);
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!open || recordId === undefined) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getRecordDetail(formKey, recordId)
      .then(async (detail) => {
        const versionSchema = await getFormSchema(formKey, detail.schemaVersion);
        if (cancelled) return;
        setRecord(detail.record);
        setSchema(versionSchema.schema);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || '加载详情失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, formKey, recordId]);

  const columns = useMemo(() => {
    if (!schema) return [];
    const userColumns = hydrateColumns(schema.columns, { mode: 'detail' });
    return [
      { dataIndex: 'id', title: '记录 ID' },
      { dataIndex: 'schemaVersion', title: 'Schema 版本' },
      { dataIndex: 'createdAt', title: '创建时间' },
      { dataIndex: 'updatedAt', title: '更新时间' },
      ...userColumns,
    ] as any[];
  }, [schema]);

  return (
    <Drawer open={open} title="记录详情" width={720} onClose={onClose} destroyOnClose>
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : error ? (
        <Alert type="error" message={error} showIcon />
      ) : schema && record ? (
        <ProDescriptions
          column={2}
          bordered
          dataSource={flattenRecord(record)}
          columns={columns}
        />
      ) : null}
    </Drawer>
  );
}
