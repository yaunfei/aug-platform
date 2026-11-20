import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Select, Switch, Typography } from 'antd';
import React, { useEffect, useMemo } from 'react';
import type { ColumnSchema } from '@/types/schema';
import { registeredComponents } from '@/utils/hydrateColumns';
import {
  type EditorColumn,
  TABLE_ONLY_TYPES,
  findColumn,
  namespaceDataIndexes,
  nextUid,
} from './columnTreeUtils';

const { Text } = Typography;

const FALLBACK_LABELS: Record<string, string> = {
  text: '短文本',
  textarea: '长文本',
  select: '下拉单选',
  radio: '单选平铺',
  checkbox: '多选',
  date: '日期',
  dateTime: '日期时间',
  dateRange: '日期区间',
  digit: '数字',
  money: '金额',
  switch: '开关',
  group: '分组',
  divider: '分割线',
  formList: '表单列表',
};

const DATA_INDEX_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

interface Props {
  open: boolean;
  mode: 'add' | 'edit';
  initial?: EditorColumn | null;
  columns: EditorColumn[];
  parentUid: string | null;
  onSubmit: (column: ColumnSchema, uid?: string) => void;
  onCancel: () => void;
}

interface FormValues {
  valueType: string;
  title: string;
  dataIndex: string;
  required?: boolean;
  hideInForm?: boolean;
  tooltip?: string;
  valueEnum?: Array<{ key: string; text: string }>;
}

export function FieldEditorModal({
  open,
  mode,
  initial,
  columns,
  parentUid,
  onSubmit,
  onCancel,
}: Props) {
  const [form] = Form.useForm<FormValues>();
  const valueType = Form.useWatch('valueType', form) || 'text';

  const components = useMemo(() => {
    const registered = registeredComponents().filter(
      (meta) => !TABLE_ONLY_TYPES.has(meta.valueType),
    );
    const list = registered.length
      ? registered.map((meta) => ({
          valueType: meta.valueType,
          label: meta.label,
          layout: meta.layout,
          requiresValueEnum: meta.requiresValueEnum,
        }))
      : Object.entries(FALLBACK_LABELS).map(([type, label]) => ({
          valueType: type,
          label,
          layout: ['group', 'divider', 'formList'].includes(type),
          requiresValueEnum: ['select', 'radio', 'checkbox', 'radioButton', 'segmented'].includes(type),
        }));
    return list.filter((item) => (parentUid ? !item.layout : true));
  }, [parentUid]);

  const currentMeta = components.find((item) => item.valueType === valueType);
  const isLayout = Boolean(currentMeta?.layout);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      form.setFieldsValue({
        valueType: initial.valueType,
        title: initial.title || '',
        dataIndex: initial.dataIndex || `field_${Date.now().toString(36).slice(-5)}`,
        required: Boolean(
          (initial.formItemProps?.rules || []).some((rule) => rule.required),
        ),
        hideInForm: Boolean(initial.hideInForm),
        tooltip: initial.tooltip,
        valueEnum: initial.valueEnum
          ? Object.entries(initial.valueEnum).map(([key, item]) => ({ key, text: item.text }))
          : undefined,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        valueType: 'text',
        title: '',
        dataIndex: `field_${Date.now().toString(36).slice(-5)}`,
        required: false,
        hideInForm: false,
      });
    }
  }, [open, initial, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    const existing = initial ? findColumn(columns, initial._uid) : null;
    const rules = [...(existing?.formItemProps?.rules || [])].filter((rule) => !rule.required);
    if (values.required && !isLayout) {
      rules.unshift({ required: true, message: `请填写${values.title}` });
    }
    const column: ColumnSchema = {
      dataIndex: values.dataIndex.trim(),
      title: values.title?.trim() || undefined,
      valueType: values.valueType,
    };
    if (values.hideInForm) column.hideInForm = true;
    if (values.tooltip) column.tooltip = values.tooltip;
    if (!isLayout && rules.length) {
      column.formItemProps = { ...(existing?.formItemProps || {}), rules };
    }
    if (!isLayout && values.valueEnum?.length) {
      column.valueEnum = Object.fromEntries(
        values.valueEnum
          .filter((item) => item?.key)
          .map((item) => [item.key.trim(), { text: (item.text || item.key).trim() }]),
      );
    }
    if (isLayout) {
      delete column.valueEnum;
      delete column.formItemProps;
      if (values.valueType === 'divider' && !column.title) delete column.title;
    }
    if (existing) {
      column.hideInSearch = existing.hideInSearch;
      column.hideInTable = existing.hideInTable;
      column.fieldProps = isLayout ? undefined : existing.fieldProps;
      column.width = isLayout ? undefined : existing.width;
      column.initialValue = isLayout ? undefined : existing.initialValue;
      column.colProps = existing.colProps;
      if (existing.columns) column.columns = existing.columns;
    }
    onSubmit(column, existing?._uid);
  };

  return (
    <Modal
      open={open}
      title={mode === 'add' ? '添加字段' : '编辑字段'}
      okText="确定"
      cancelText="取消"
      onOk={handleOk}
      onCancel={onCancel}
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="valueType" label="组件类型" rules={[{ required: true }]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={[
              {
                label: '字段组件',
                options: components
                  .filter((item) => !item.layout)
                  .map((item) => ({ label: `${item.label}（${item.valueType}）`, value: item.valueType })),
              },
              {
                label: '布局组件',
                options: components
                  .filter((item) => item.layout)
                  .map((item) => ({ label: `${item.label}（${item.valueType}）`, value: item.valueType })),
              },
            ].filter((group) => group.options.length)}
          />
        </Form.Item>

        <Form.Item
          name="title"
          label="字段标题"
          rules={[{ required: valueType !== 'divider', message: '请输入字段标题' }]}
        >
          <Input maxLength={64} placeholder="例如：客户名称" />
        </Form.Item>

        <Form.Item
          name="dataIndex"
          label="dataIndex"
          rules={[
            { required: true, message: '请输入 dataIndex' },
            { pattern: DATA_INDEX_RE, message: '字母开头，仅字母/数字/下划线，2-64 字符' },
            {
              validator: async (_rule, value: string) => {
                if (!value) return;
                const names = namespaceDataIndexes(
                  columns,
                  parentUid,
                  initial?._uid,
                );
                if (names.includes(value.trim())) {
                  throw new Error(`dataIndex ${value} 与当前命名空间重复`);
                }
              },
            },
          ]}
        >
          <Input placeholder="例如：customer_name" disabled={Boolean(isLayout && valueType === 'divider')} />
        </Form.Item>

        {!isLayout ? (
          <>
            <Form.Item name="required" label="必填" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="hideInForm" label="表单中隐藏" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="tooltip" label="提示文案">
              <Input placeholder="字段说明 / tooltip" />
            </Form.Item>
          </>
        ) : null}

        {!isLayout && currentMeta?.requiresValueEnum ? (
          <Form.Item label="选项（valueEnum）" required>
            <Form.List name="valueEnum">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <div key={field.key} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <Form.Item
                        name={[field.name, 'key']}
                        rules={[{ required: true, message: 'key' }]}
                        style={{ marginBottom: 0, flex: 1 }}
                      >
                        <Input placeholder="存储值 key" />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'text']}
                        rules={[{ required: true, message: '展示文本' }]}
                        style={{ marginBottom: 0, flex: 1 }}
                      >
                        <Input placeholder="展示文本" />
                      </Form.Item>
                      <Button
                        type="text"
                        danger
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(field.name)}
                      />
                    </div>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ key: '', text: '' })}>
                    添加选项
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
        ) : null}

        {isLayout && valueType === 'group' ? (
          <Text type="secondary">
            group 子字段数据扁平存储，子字段 dataIndex 需与全表单共享命名空间。
          </Text>
        ) : null}
        {isLayout && valueType === 'formList' ? (
          <Text type="secondary">
            formList 存储对象数组，子字段使用独立命名空间；表格中降级为条数展示。
          </Text>
        ) : null}
      </Form>
    </Modal>
  );
}
