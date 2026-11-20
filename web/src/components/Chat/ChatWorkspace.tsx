import { SendOutlined, StopOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Input, Space, Spin, Tag, Typography, message as antdMessage } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { chatAssistantStream } from '@/services/api';
import type { ChatMessage, ChatResponse, FormSchema } from '@/types/schema';
import { toApiMessages } from '@/utils/chatMessages';
import { summarizeSchemaDiff } from '@/utils/summarizeSchemaDiff';
import { MessageItem } from './MessageItem';

const { Text } = Typography;
const { TextArea } = Input;

const EXAMPLES = [
  '生成一个用户反馈表单，包含标题、反馈类型、详细描述、截图、联系方式',
  '查看平台有哪些表单',
  '审查当前草稿的字段设计是否合理',
  '生成 3 条当前草稿的样例数据',
];

function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface Props {
  sessionKey: string;
  messages: ChatMessage[];
  draftSchema: FormSchema | null;
  onMessagesChange: (messages: ChatMessage[]) => void;
  onDraftChange: (schema: FormSchema | null) => void;
}

export function ChatWorkspace({
  sessionKey,
  messages,
  draftSchema,
  onMessagesChange,
  onDraftChange,
}: Props) {
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [stage, setStage] = useState('');
  const messagesRef = useRef<ChatMessage[]>(messages);
  const draftRef = useRef<FormSchema | null>(draftSchema);
  const abortRef = useRef<AbortController | null>(null);
  const activeAssistantRef = useRef<string>('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    draftRef.current = draftSchema;
  }, [draftSchema]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const setMessages = useCallback(
    (next: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      const value = typeof next === 'function' ? next(messagesRef.current) : next;
      messagesRef.current = value;
      onMessagesChange(value);
    },
    [onMessagesChange],
  );

  const patchMessage = useCallback(
    (id: string, patch: Partial<ChatMessage> | ((prev: ChatMessage) => Partial<ChatMessage>)) => {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) }
            : item,
        ),
      );
    },
    [setMessages],
  );

  const finishWithResponse = useCallback(
    (assistantId: string, data: ChatResponse) => {
      const prevDraft = draftRef.current;
      const isSchemaIntent = data.intent === 'generate' || data.intent === 'modify';
      const applied = isSchemaIntent && data.schema ? (data.schema as FormSchema) : undefined;
      if (applied) {
        onDraftChange(applied);
        draftRef.current = applied;
      }
      patchMessage(assistantId, (prev) => ({
        ...prev,
        content: data.reply || prev.content,
        intent: data.intent,
        schema: applied,
        proposedSchema:
          data.schema && !isSchemaIntent ? (data.schema as FormSchema) : undefined,
        action: data.action,
        sampleData: data.sampleData,
        suggestions: data.suggestions,
        warnings: data.warnings || [],
        diffSummary: applied ? summarizeSchemaDiff(prevDraft, applied) : undefined,
        streaming: false,
        error: false,
      }));
    },
    [onDraftChange, patchMessage],
  );

  const send = useCallback(
    async (raw?: string) => {
      const content = (raw ?? input).trim();
      if (!content || streaming) return;
      const userMessage: ChatMessage = {
        id: uid(),
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      };
      const assistantId = uid();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        streaming: true,
        createdAt: new Date().toISOString(),
      };
      const base = [...messagesRef.current, userMessage];
      setMessages([...base, assistantMessage]);
      setInput('');
      setStreaming(true);
      setStage('思考中…');
      activeAssistantRef.current = assistantId;
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await chatAssistantStream(
          toApiMessages(base) as ChatMessage[],
          draftRef.current,
          (event) => {
            if (event.type === 'delta') {
              const text = event.text ?? event.content ?? '';
              setStage('');
              patchMessage(assistantId, (prev) => ({ content: prev.content + text }));
            } else if (event.type === 'stage') {
              setStage(event.message || event.text || '处理中…');
            } else if (event.type === 'reset') {
              patchMessage(assistantId, { content: '' });
            } else if (event.type === 'final') {
              finishWithResponse(assistantId, event.data);
            } else if (event.type === 'error') {
              patchMessage(assistantId, {
                streaming: false,
                error: true,
                content: event.message || 'AI 服务异常，请稍后重试',
              });
            }
          },
          controller.signal,
        );
        const latest = messagesRef.current.find((item) => item.id === assistantId);
        if (latest?.streaming) {
          patchMessage(assistantId, {
            streaming: false,
            content: latest.content || '未收到回答，请重试',
          });
        }
      } catch (err) {
        if (controller.signal.aborted) {
          patchMessage(assistantId, (prev) => ({
            streaming: false,
            content: `${prev.content}\n\n（已停止生成）`,
          }));
        } else {
          patchMessage(assistantId, {
            streaming: false,
            error: true,
            content: (err as Error).message || '请求失败',
          });
        }
      } finally {
        setStreaming(false);
        setStage('');
        abortRef.current = null;
        activeAssistantRef.current = '';
      }
    },
    [input, streaming, finishWithResponse, patchMessage, setMessages],
  );

  const stop = () => {
    abortRef.current?.abort();
  };

  const handleAdopt = (schema: FormSchema) => {
    onDraftChange(schema);
    draftRef.current = schema;
    antdMessage.success('已采纳提案为当前草稿');
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'assistant',
        content: `已将提案 Schema 采纳为草稿（formKey: ${schema.formKey}）。可在右侧预览或点击「发布」。`,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        {messages.length ? (
          messages.map((item) => (
            <MessageItem
              key={item.id || `${item.role}-${item.createdAt || item.content.slice(0, 8)}`}
              message={item}
              draftSchema={draftSchema}
              onAdoptSchema={handleAdopt}
              onSuggest={(text) => send(text)}
              onActionDone={(text) =>
                setMessages((prev) => [
                  ...prev,
                  { id: uid(), role: 'assistant', content: text, createdAt: new Date().toISOString() },
                ])
              }
            />
          ))
        ) : (
          <Card bordered={false} style={{ marginTop: 24 }}>
            <Empty description="开始一段对话，让 AI 帮你生成或修改表单" />
            <Space wrap style={{ marginTop: 16, justifyContent: 'center', width: '100%' }}>
              {EXAMPLES.map((example) => (
                <Tag
                  key={example}
                  color="blue"
                  style={{ cursor: 'pointer', padding: '4px 8px' }}
                  onClick={() => send(example)}
                >
                  {example}
                </Tag>
              ))}
            </Space>
          </Card>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: '1px solid #f0f0f0', padding: 12, background: '#fff' }}>
        {stage ? (
          <div style={{ marginBottom: 8 }}>
            <Space>
              <Spin size="small" />
              <Text type="secondary">{stage}</Text>
            </Space>
          </div>
        ) : null}
        {streaming && !stage ? (
          <div style={{ marginBottom: 8 }}>
            <Space>
              <Spin size="small" />
              <Text type="secondary">助手正在生成，可点击停止</Text>
            </Space>
          </div>
        ) : null}
        <TextArea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="描述你的需求，Enter 发送，Shift+Enter 换行"
          autoSize={{ minRows: 2, maxRows: 6 }}
          maxLength={20000}
          disabled={streaming}
          onPressEnter={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (!event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            会话：{sessionKey} · 上下文超长自动截断
          </Text>
          <Space>
            {streaming ? (
              <Button danger icon={<StopOutlined />} onClick={stop}>
                停止
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<SendOutlined />}
                disabled={!input.trim()}
                onClick={() => send()}
              >
                发送
              </Button>
            )}
          </Space>
        </div>
      </div>
    </div>
  );
}
