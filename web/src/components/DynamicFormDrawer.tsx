import { BetaSchemaForm } from '@ant-design/pro-components';
import { message } from 'antd';
import React, { useMemo } from 'react';
import { submitRecord, updateRecord } from '@/services/api';
import type { FormSchema } from '@/types/schema';
import { hydrateColumns } from '@/utils/hydrateColumns';
import { buildInitialValues, serializeFormValues } from '@/utils/formValues';

export type FormDrawerMode = 'create' | 'edit' | 'preview';

interface Props {
  open: boolean;
  mode: FormDrawerMode;
  formKey: string;
  schema: FormSchema | null;
  data?: Record<string, unknown> | null;
  recordId?: number;
  onClose: () => void;
  onSuccess?: () => void;
}

const TITLES: Record<FormDrawerMode, string> = {
  create: '新增记录',
  edit: '编辑记录',
  preview: '校验表单',
};

/**
 * 抽屉打开才挂载、关闭即卸载（规避 pro-form 常驻挂载不重建表单项的缺陷）。
 */
export function DynamicFormDrawer({
  open,
  mode,
  formKey,
  schema,
  data,
  recordId,
  onClose,
  onSuccess,
}: Props) {
  const columns = useMemo(
    () => (schema ? hydrateColumns(schema.columns, { mode: 'form' }) : []),
    [schema],
  );
  const initialValues = useMemo(() => buildInitialValues(schema, data), [schema, data]);

  if (!open || !schema) return null;

  return (
    <BetaSchemaForm
      layoutType="DrawerForm"
      title={TITLES[mode]}
      open={open}
      width={720}
      columns={columns as any}
      initialValues={initialValues}
      onOpenChange={(visible) => {
        if (!visible) onClose();
      }}
      submitter={
        mode === 'preview'
          ? { searchConfig: { submitText: '校验' }, resetButtonProps: { style: { display: 'none' } } }
          : undefined
      }
      onFinish={async (values: Record<string, unknown>) => {
        const payload = serializeFormValues(values) as Record<string, unknown>;
        if (mode === 'preview') {
          message.success('校验通过');
          return false;
        }
        try {
          if (mode === 'edit' && recordId !== undefined) {
            await updateRecord(formKey, recordId, payload);
            message.success('更新成功');
          } else {
            await submitRecord(formKey, payload);
            message.success('提交成功');
          }
          onSuccess?.();
          onClose();
          return true;
        } catch {
          return false;
        }
      }}
    />
  );
}
