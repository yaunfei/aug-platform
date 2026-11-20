import { DeleteOutlined, EditOutlined, EyeOutlined, HistoryOutlined, LoginOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Button, DatePicker, Popconfirm, Space, Typography, message } from 'antd';
import type { Dayjs } from 'dayjs';
import React, { useCallback, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DynamicFormDrawer } from '@/components/DynamicFormDrawer';
import { SchemaErrorBoundary } from '@/components/SchemaErrorBoundary';
import { VersionDrawer } from '@/components/VersionDrawer';
import { deleteSchema, listSchemas } from '@/services/api';
import type { SchemaVersion } from '@/types/schema';

const { RangePicker } = DatePicker;
const { Text } = Typography;

export default function SchemaListPage() {
  const actionRef = useRef<ActionType>();
  const [timeRange, setTimeRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [preview, setPreview] = useState<SchemaVersion | null>(null);
  const [versionKey, setVersionKey] = useState<string>('');

  const handleDelete = useCallback(async (formKey: string) => {
    try {
      await deleteSchema(formKey);
      message.success(`已删除 ${formKey} 及其全部版本与记录`);
      actionRef.current?.reload();
    } catch {
      // API 层已提示
    }
  }, []);

  const columns: ProColumns<SchemaVersion>[] = [
    {
      title: 'formKey',
      dataIndex: 'formKey',
      copyable: true,
      width: 180,
    },
    { title: '标题', dataIndex: 'title' },
    {
      title: '当前版本',
      dataIndex: 'version',
      hideInSearch: true,
      width: 110,
      render: (version) => <Text type="success">v{String(version)}</Text>,
    },
    {
      title: '发布时间',
      dataIndex: 'createdAt',
      hideInSearch: true,
      width: 200,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 300,
      fixed: 'right',
      render: (_dom, record) => (
        <Space size="small" wrap>
          <a onClick={() => setPreview(record)}>
            <EyeOutlined /> 查看
          </a>
          <a onClick={() => history.push(`/schema-generate?formKey=${record.formKey}`)}>
            <EditOutlined /> 编辑
          </a>
          <a onClick={() => setVersionKey(record.formKey)}>
            <HistoryOutlined /> 版本
          </a>
          <a onClick={() => history.push(`/form/${record.formKey}`)}>
            <LoginOutlined /> 进入表单
          </a>
          <Popconfirm
            title={`删除 ${record.formKey}？`}
            description="将级联删除该表单全部版本与全部提交记录，不可恢复"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record.formKey)}
          >
            <a style={{ color: '#ff4d4f' }}>
              <DeleteOutlined /> 删除
            </a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AppShell>
      <SchemaErrorBoundary>
        <div style={{ padding: '24px 32px' }}>
          <ProTable<SchemaVersion>
            actionRef={actionRef}
            rowKey="formKey"
            headerTitle="已发布 Schema"
            columns={columns}
            search={{ labelWidth: 'auto' }}
            options={false}
            scroll={{ x: 'max-content' }}
            dateFormatter="string"
            params={{
              __timeStart: timeRange?.[0]?.valueOf(),
              __timeEnd: timeRange?.[1]?.valueOf(),
            }}
            request={async (params) => {
              try {
                const data = await listSchemas({
                  formKey: params.formKey,
                  title: params.title,
                  startTime: timeRange?.[0]?.toISOString(),
                  endTime: timeRange?.[1]?.toISOString(),
                });
                return {
                  data,
                  total: data.length,
                  success: true,
                };
              } catch {
                return { data: [], total: 0, success: false };
              }
            }}
            pagination={{ defaultPageSize: 20, showSizeChanger: true }}
            toolBarRender={() => [
              <RangePicker
                key="range"
                showTime
                value={timeRange}
                onChange={(value) => setTimeRange(value as [Dayjs, Dayjs] | null)}
              />,
              <Button
                key="generate"
                type="primary"
                onClick={() => history.push('/schema-generate')}
              >
                AI 生成新表单
              </Button>,
            ]}
          />
        </div>

        <DynamicFormDrawer
          open={Boolean(preview)}
          mode="preview"
          formKey={preview?.formKey || ''}
          schema={preview?.schema || null}
          onClose={() => setPreview(null)}
        />

        <VersionDrawer
          open={Boolean(versionKey)}
          formKey={versionKey}
          onClose={() => setVersionKey('')}
          onChanged={() => actionRef.current?.reload()}
        />
      </SchemaErrorBoundary>
    </AppShell>
  );
}
