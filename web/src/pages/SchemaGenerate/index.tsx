import {
  CodeOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { history, useLocation } from '@umijs/max';
import {
  Alert,
  Button,
  Drawer,
  Input,
  Space,
  Spin,
  Tag,
  Typography,
  message as antdMessage,
  Modal,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ChatWorkspace } from '@/components/Chat/ChatWorkspace';
import { SessionSidebar } from '@/components/Chat/SessionSidebar';
import { DynamicFormDrawer } from '@/components/DynamicFormDrawer';
import { SchemaErrorBoundary } from '@/components/SchemaErrorBoundary';
import { VisualEditor } from '@/components/VisualEditor';
import {
  deleteChatSession,
  getChatSession,
  getFormSchema,
  listChatSessions,
  publishSchema,
  saveChatSession,
} from '@/services/api';
import type { ChatMessage, ChatSession, FormSchema } from '@/types/schema';
import { summarizeSchemaDiff } from '@/utils/summarizeSchemaDiff';
import { validateSchema } from '@/utils/validateSchema';

const { Text, Title } = Typography;
const { TextArea } = Input;

function newSessionKey(): string {
  return `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function countFields(columns: FormSchema['columns'] | undefined): number {
  return (columns || []).reduce((total, column) => {
    if (column.valueType === 'group') return total + countFields(column.columns);
    if (column.valueType === 'divider') return total;
    return total + 1;
  }, 0);
}

export default function SchemaGeneratePage() {
  const location = useLocation();
  const queryFormKey = useMemo(
    () => new URLSearchParams(location.search).get('formKey') || '',
    [location.search],
  );

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionKey, setSessionKey] = useState(newSessionKey);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<FormSchema | null>(null);
  const [published, setPublished] = useState<FormSchema | null>(null);
  const [publishedVersion, setPublishedVersion] = useState(0);
  const [loadingSession, setLoadingSession] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(Boolean(queryFormKey));
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [visualOpen, setVisualOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const migrateLegacySession = () => {
    try {
      const legacyMessages = localStorage.getItem('aug_chat_messages');
      const legacyDraft = localStorage.getItem('aug_schema_draft');
      if (!legacyMessages && !legacyDraft) {
        localStorage.setItem('aug_migrated', '1');
        return;
      }
      const parsedMessages = legacyMessages ? JSON.parse(legacyMessages) : [];
      const parsedDraft = legacyDraft ? JSON.parse(legacyDraft) : null;
      const key = newSessionKey();
      if (Array.isArray(parsedMessages) && parsedMessages.length) {
        setSessionKey(key);
        setMessages(parsedMessages);
        if (parsedDraft && validateSchema(parsedDraft).ok) setDraft(parsedDraft);
        saveChatSession(key, {
          messages: parsedMessages,
          schemaJson: parsedDraft ? JSON.stringify(parsedDraft) : '',
        })
          .then(() => listChatSessions().then(setSessions).catch(() => undefined))
          .catch(() => undefined);
      }
      localStorage.setItem('aug_migrated', '1');
      localStorage.removeItem('aug_chat_messages');
      localStorage.removeItem('aug_schema_draft');
    } catch {
      localStorage.setItem('aug_migrated', '1');
    }
  };

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const data = await listChatSessions();
      setSessions(data);
      // 一次性迁移旧 localStorage 会话（后端无任何会话时）
      if (!data.length && localStorage.getItem('aug_migrated') !== '1') {
        migrateLegacySession();
      }
    } catch {
      // 后端未启动时静默
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // 从 Schema 管理页带 formKey 进入：加载已发布版本作为编辑基线
  useEffect(() => {
    if (!queryFormKey) {
      setLoadingSchema(false);
      return;
    }
    let cancelled = false;
    setLoadingSchema(true);
    getFormSchema(queryFormKey)
      .then((data) => {
        if (cancelled) return;
        setDraft(data.schema);
        setPublished(data.schema);
        setPublishedVersion(data.version);
        setVisualOpen(true);
      })
      .catch((err: Error) => {
        if (!cancelled) antdMessage.error(err.message || '加载 Schema 失败');
      })
      .finally(() => {
        if (!cancelled) setLoadingSchema(false);
      });
    return () => {
      cancelled = true;
    };
  }, [queryFormKey]);

  // 会话持久化：800ms 防抖，无消息不建档
  useEffect(() => {
    if (!messages.length) return;
    const timer = window.setTimeout(() => {
      saveChatSession(sessionKey, {
        messages,
        schemaJson: draft ? JSON.stringify(draft) : '',
      })
        .then(() => refreshSessions())
        .catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [messages, draft, sessionKey, refreshSessions]);

  const handleSelectSession = async (session: ChatSession) => {
    if (session.sessionKey === sessionKey) return;
    setLoadingSession(true);
    try {
      const full = await getChatSession(session.sessionKey);
      setSessionKey(full.sessionKey);
      setMessages((full.messages || []).map((item) => ({ ...item, streaming: false })));
      let parsed: FormSchema | null = null;
      if (full.schemaJson) {
        try {
          const candidate = JSON.parse(full.schemaJson);
          if (validateSchema(candidate).ok) parsed = candidate as FormSchema;
        } catch {
          antdMessage.warning('该会话的草稿 Schema 已损坏，已忽略');
        }
      }
      setDraft(parsed);
      if (parsed?.formKey) {
        getFormSchema(parsed.formKey)
          .then((data) => {
            setPublished(data.schema);
            setPublishedVersion(data.version);
          })
          .catch(() => {
            setPublished(null);
            setPublishedVersion(0);
          });
      } else {
        setPublished(null);
        setPublishedVersion(0);
      }
    } catch {
      antdMessage.error('会话加载失败');
    } finally {
      setLoadingSession(false);
    }
  };

  const handleNewSession = () => {
    setSessionKey(newSessionKey());
    setMessages([]);
  };

  const handleDeleteSession = async (key: string) => {
    try {
      await deleteChatSession(key);
      antdMessage.success('会话已删除');
      if (key === sessionKey) {
        handleNewSession();
      }
      refreshSessions();
    } catch {
      // API 层已提示
    }
  };

  const openJson = () => {
    if (!draft) {
      antdMessage.warning('当前还没有草稿，请先生成');
      return;
    }
    setJsonText(JSON.stringify(draft, null, 2));
    setJsonOpen(true);
  };

  const saveJson = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      antdMessage.error(`JSON 解析失败：${(err as Error).message}`);
      return;
    }
    const result = validateSchema(parsed);
    if (!result.ok) {
      antdMessage.error(result.errors.join('；'));
      return;
    }
    setDraft(parsed as FormSchema);
    setJsonOpen(false);
    antdMessage.success('草稿已更新');
  };

  const handlePublish = () => {
    if (!draft) return;
    const result = validateSchema(draft);
    if (!result.ok) {
      Modal.error({ title: 'Schema 校验未通过', content: result.errors.join('；') });
      return;
    }
    const summary = summarizeSchemaDiff(published, draft);
    Modal.confirm({
      title: `发布 ${draft.formKey}？`,
      width: 620,
      content: (
        <div>
          <p style={{ marginBottom: 8 }}>本次变更：</p>
          <Alert type="info" showIcon description={summary} />
          <p style={{ marginTop: 12 }}>
            <Text type="secondary">
              发布后会生成新版本 v{publishedVersion + 1}，历史记录不受影响。
            </Text>
          </p>
        </div>
      ),
      okText: '确认发布',
      cancelText: '取消',
      onOk: async () => {
        try {
          const version = await publishSchema(draft.formKey, draft);
          setPublished(version.schema);
          setPublishedVersion(version.version);
          antdMessage.success(`发布成功，版本 v${version.version}`);
          history.replace(`/schema-generate?formKey=${draft.formKey}`);
        } catch {
          // API 层已提示
        }
      },
    });
  };

  const draftFields = draft ? countFields(draft.columns) : 0;

  return (
    <AppShell>
      <SchemaErrorBoundary>
        {loadingSchema ? (
          <div style={{ padding: 80, textAlign: 'center' }}>
            <Spin tip="加载已发布 Schema…" />
          </div>
        ) : (
          <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
            <SessionSidebar
              sessions={sessions}
              currentKey={sessionKey}
              loading={sessionsLoading}
              onNew={handleNewSession}
              onSelect={handleSelectSession}
              onDelete={handleDeleteSession}
              onRefresh={refreshSessions}
            />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div
                style={{
                  padding: '10px 20px',
                  background: '#fff',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <Space size={12} wrap>
                  <Title level={5} style={{ margin: 0 }}>
                    AI 对话生成
                  </Title>
                  {draft ? (
                    <>
                      <Tag color="blue">{draft.formKey}</Tag>
                      <Text type="secondary">{draft.title || '未命名表单'}</Text>
                      <Tag>{draftFields} 个字段</Tag>
                    </>
                  ) : (
                    <Tag>暂无草稿</Tag>
                  )}
                </Space>
                <Space wrap>
                  <Button icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)} disabled={!draft}>
                    预览
                  </Button>
                  <Button icon={<FileTextOutlined />} onClick={openJson} disabled={!draft}>
                    JSON 直编
                  </Button>
                  <Button
                    icon={<CodeOutlined />}
                    onClick={() => setVisualOpen(true)}
                    disabled={!draft}
                  >
                    可视化
                  </Button>
                  <Button
                    type="primary"
                    icon={<RocketOutlined />}
                    onClick={handlePublish}
                    disabled={!draft}
                  >
                    发布
                  </Button>
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setSessionKey(newSessionKey());
                      setMessages([]);
                    }}
                  >
                    新会话
                  </Button>
                </Space>
              </div>

              <div style={{ flex: 1, minHeight: 0 }}>
                {loadingSession ? (
                  <div style={{ padding: 80, textAlign: 'center' }}>
                    <Spin />
                  </div>
                ) : (
                  <ChatWorkspace
                    key={sessionKey}
                    sessionKey={sessionKey}
                    messages={messages}
                    draftSchema={draft}
                    onMessagesChange={setMessages}
                    onDraftChange={setDraft}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <Drawer
          open={jsonOpen}
          title="JSON 直编（兼容高级用户）"
          width={760}
          onClose={() => setJsonOpen(false)}
          extra={
            <Space>
              <Button
                onClick={() => {
                  try {
                    setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2));
                  } catch {
                    antdMessage.error('JSON 解析失败，无法格式化');
                  }
                }}
              >
                格式化
              </Button>
              <Button type="primary" onClick={saveJson}>
                保存为草稿
              </Button>
            </Space>
          }
        >
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="保存时会做前端轻校验，完整契约仍以后端发布校验为准。"
          />
          <TextArea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            autoSize={{ minRows: 24, maxRows: 34 }}
            style={{ fontFamily: 'Menlo, Consolas, monospace', fontSize: 12 }}
          />
        </Drawer>

        <VisualEditor
          open={visualOpen}
          schema={draft}
          onChange={(next) => setDraft(next)}
          onClose={() => setVisualOpen(false)}
        />

        <DynamicFormDrawer
          open={previewOpen}
          mode="preview"
          formKey={draft?.formKey || ''}
          schema={draft}
          onClose={() => setPreviewOpen(false)}
        />
      </SchemaErrorBoundary>
    </AppShell>
  );
}
