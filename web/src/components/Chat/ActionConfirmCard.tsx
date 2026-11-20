import { ExclamationCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Modal, Space, Typography, message } from 'antd';
import React, { useState } from 'react';
import { deleteSchema, exportUrl, publishSchema, rollbackSchema } from '@/services/api';
import type { FormSchema, ProposedAction } from '@/types/schema';

const { Text } = Typography;

const ACTION_LABELS: Record<ProposedAction['type'], string> = {
  delete: '删除表单',
  publish: '发布 Schema',
  rollback: '回滚版本',
  export: '导出 CSV',
};

interface Props {
  action: ProposedAction;
  schema?: FormSchema | null;
  onDone?: (text: string) => void;
}

/** 危险操作确认卡片：助手只提议，用户点确认才真正执行。 */
export function ActionConfirmCard({ action, schema, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const label = ACTION_LABELS[action.type] || action.type;

  const execute = () => {
    const describe = (
      <div>
        <p>
          即将执行：<Text strong>{label}</Text>
        </p>
        <p>
          formKey：<Text code>{action.formKey}</Text>
          {action.version ? (
            <>
              ，版本：<Text code>v{action.version}</Text>
            </>
          ) : null}
        </p>
        {action.type === 'delete' ? (
          <Text type="danger">该操作会级联删除全部版本与记录，且不可恢复。</Text>
        ) : null}
        {action.type === 'publish' && !schema ? (
          <Text type="danger">当前没有可发布的草稿 Schema。</Text>
        ) : null}
      </div>
    );

    Modal.confirm({
      title: '确认执行该操作？',
      icon: <ExclamationCircleOutlined />,
      content: describe,
      okText: '确认执行',
      okButtonProps: { danger: action.type === 'delete' },
      cancelText: '取消',
      onOk: async () => {
        setLoading(true);
        try {
          if (action.type === 'delete') {
            await deleteSchema(action.formKey);
            message.success('表单已删除');
            onDone?.(`已删除表单 ${action.formKey}`);
          } else if (action.type === 'publish') {
            if (!schema) {
              message.error('缺少草稿 Schema，无法发布');
              return;
            }
            const result = await publishSchema(action.formKey, schema);
            message.success(`发布成功，版本 v${result.version}`);
            onDone?.(`已发布 ${action.formKey} v${result.version}`);
          } else if (action.type === 'rollback') {
            if (!action.version) {
              message.error('缺少回滚版本号');
              return;
            }
            const result = await rollbackSchema(action.formKey, action.version);
            message.success(`已前滚发布 v${action.version} 的内容，新版本 v${result.version}`);
            onDone?.(`已回滚 ${action.formKey} 至 v${action.version}`);
          } else if (action.type === 'export') {
            window.open(exportUrl(action.formKey), '_blank', 'noopener');
            onDone?.('已打开导出下载');
          }
        } catch {
          // API 层已提示
        } finally {
          setLoading(false);
        }
      },
    });
  };

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginTop: 8 }}
      message={`待确认操作：${label}`}
      description={
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Text type="secondary">
            formKey：{action.formKey}
            {action.version ? ` · v${action.version}` : ''}
          </Text>
          <Button size="small" danger={action.type === 'delete'} loading={loading} onClick={execute}>
            确认执行
          </Button>
        </Space>
      }
    />
  );
}
