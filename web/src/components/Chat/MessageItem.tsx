import {
  CheckCircleOutlined,
  CopyOutlined,
  RobotOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Avatar, Button, Card, Collapse, Space, Tag, Tooltip, Typography, message as antdMessage } from 'antd';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import React, { useMemo } from 'react';
import type { ChatMessage, FormSchema } from '@/types/schema';
import { ActionConfirmCard } from './ActionConfirmCard';
import { SampleDataPreview } from './SampleDataPreview';

const { Text } = Typography;

const INTENT_LABELS: Record<string, { text: string; color: string }> = {
  generate: { text: '生成', color: 'green' },
  modify: { text: '修改', color: 'blue' },
  review: { text: '审查', color: 'gold' },
  sample_data: { text: '样例数据', color: 'purple' },
  action: { text: '操作提议', color: 'red' },
  reply: { text: '回答', color: 'default' },
};

function renderMarkdown(content: string): string {
  const html = marked.parse(content || '', { async: false, gfm: true, breaks: true }) as string;
  return DOMPurify.sanitize(html);
}

interface Props {
  message: ChatMessage;
  draftSchema?: FormSchema | null;
  onAdoptSchema?: (schema: FormSchema) => void;
  onSuggest?: (text: string) => void;
  onActionDone?: (text: string) => void;
}

export function MessageItem({ message, draftSchema, onAdoptSchema, onSuggest, onActionDone }: Props) {
  const isUser = message.role === 'user';
  const html = useMemo(
    () => (!isUser ? renderMarkdown(message.content) : ''),
    [isUser, message.content],
  );
  const intent = message.intent ? INTENT_LABELS[message.intent] : undefined;

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        marginBottom: 20,
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}
    >
      <Avatar
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        style={{ background: isUser ? '#1677ff' : '#52c41a', flexShrink: 0 }}
      />
      <div style={{ maxWidth: '82%', minWidth: 120 }}>
        <Space size={6} style={{ marginBottom: 6 }}>
          <Text strong>{isUser ? '我' : '助手'}</Text>
          {intent ? <Tag color={intent.color}>{intent.text}</Tag> : null}
          {message.streaming ? <Tag color="processing">生成中</Tag> : null}
        </Space>

        <div
          style={{
            background: isUser ? '#e6f4ff' : '#fff',
            border: `1px solid ${isUser ? '#bae0ff' : '#f0f0f0'}`,
            borderRadius: 10,
            padding: '10px 14px',
          }}
        >
          {isUser ? (
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</div>
          ) : message.content ? (
            <div
              className="markdown-body"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <Text type="secondary">{message.streaming ? '正在思考…' : '（空消息）'}</Text>
          )}
          {message.streaming ? <span className="typing-cursor">▍</span> : null}

          {message.error ? (
            <Alert style={{ marginTop: 8 }} type="error" showIcon message="生成失败，请重试" />
          ) : null}

          {message.warnings?.length ? (
            <Alert
              style={{ marginTop: 8 }}
              type="warning"
              showIcon
              message="提示"
              description={
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {message.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              }
            />
          ) : null}

          {message.diffSummary ? (
            <Card size="small" style={{ marginTop: 10, background: '#f6ffed' }}>
              <Space size={6}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <Text type="secondary">变更摘要</Text>
              </Space>
              <div style={{ marginTop: 4 }}>{message.diffSummary}</div>
            </Card>
          ) : null}

          {message.sampleData?.length ? (
            <div style={{ marginTop: 10 }}>
              <SampleDataPreview data={message.sampleData} />
            </div>
          ) : null}

          {message.proposedSchema ? (
            <Card
              size="small"
              style={{ marginTop: 10 }}
              title="提案 Schema（待采纳）"
              extra={
                onAdoptSchema ? (
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => onAdoptSchema(message.proposedSchema as FormSchema)}
                  >
                    采纳为草稿
                  </Button>
                ) : null
              }
            >
              <Collapse
                ghost
                size="small"
                items={[
                  {
                    key: 'json',
                    label: `${message.proposedSchema.formKey} · ${message.proposedSchema.columns?.length || 0} 个字段`,
                    children: (
                      <pre style={{ maxHeight: 240, overflow: 'auto', fontSize: 12 }}>
                        {JSON.stringify(message.proposedSchema, null, 2)}
                      </pre>
                    ),
                  },
                ]}
              />
            </Card>
          ) : null}

          {message.schema && !message.proposedSchema ? (
            <Collapse
              ghost
              size="small"
              style={{ marginTop: 8 }}
              items={[
                {
                  key: 'schema',
                  label: <Text type="secondary">已应用到草稿：{message.schema.formKey}</Text>,
                  children: (
                    <pre style={{ maxHeight: 240, overflow: 'auto', fontSize: 12 }}>
                      {JSON.stringify(message.schema, null, 2)}
                    </pre>
                  ),
                },
              ]}
            />
          ) : null}

          {message.action ? (
            <ActionConfirmCard
              action={message.action}
              schema={message.action.type === 'publish' ? draftSchema : undefined}
              onDone={onActionDone}
            />
          ) : null}

          {message.suggestions?.length ? (
            <Space wrap style={{ marginTop: 10 }}>
              {message.suggestions.map((suggestion) => (
                <Tag
                  key={suggestion}
                  color="blue"
                  style={{ cursor: onSuggest ? 'pointer' : 'default' }}
                  onClick={() => onSuggest?.(suggestion)}
                >
                  {suggestion}
                </Tag>
              ))}
            </Space>
          ) : null}

          {!isUser && message.content && !message.streaming ? (
            <div style={{ marginTop: 6, textAlign: 'right' }}>
              <Tooltip title="复制内容">
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(message.content);
                      antdMessage.success('已复制');
                    } catch {
                      antdMessage.warning('当前浏览器不支持复制');
                    }
                  }}
                />
              </Tooltip>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
