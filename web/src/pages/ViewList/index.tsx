import {
  DeleteOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  PlusOutlined,
  RocketOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { SchemaErrorBoundary } from '@/components/SchemaErrorBoundary';
import {
  deleteView,
  generateViewMapping,
  listSchemas,
  listViewVersions,
  listViews,
  publishView,
  rollbackView,
  testView,
} from '@/services/api';
import type {
  MappingItem,
  MappingType,
  SchemaVersion,
  ViewConfig,
  ViewTestResult,
  ViewVersion,
} from '@/types/schema';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const MAPPING_TYPES: MappingType[] = [
  'string',
  'long',
  'double',
  'decimal',
  'boolean',
  'datetime',
  'enum',
  'array',
  'const',
];

function parseJson(text: string): unknown {
  return JSON.parse(text);
}

function toJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export default function ViewListPage() {
  const [schemas, setSchemas] = useState<SchemaVersion[]>([]);
  const [views, setViews] = useState<ViewVersion[]>([]);
  const [formKey, setFormKey] = useState('');
  const [docText, setDocText] = useState('');
  const [configText, setConfigText] = useState('');
  const [configObj, setConfigObj] = useState<ViewConfig | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ViewTestResult | null>(null);
  const [recordId, setRecordId] = useState('');
  const [sampleText, setSampleText] = useState('');
  const [versionOpen, setVersionOpen] = useState(false);
  const [versions, setVersions] = useState<ViewVersion[]>([]);
  const [versionKey, setVersionKey] = useState('');
  const [activeTab, setActiveTab] = useState('mapping');
  const [tested, setTested] = useState(false);

  const loadSchemas = useCallback(async () => {
    try {
      const data = await listSchemas();
      setSchemas(data);
      if (!formKey && data.length) setFormKey(data[0].formKey);
    } catch {
      // API 层已提示
    }
  }, [formKey]);

  const loadViews = useCallback(async (key: string) => {
    try {
      setViews(await listViews(key || undefined));
    } catch {
      setViews([]);
    }
  }, []);

  useEffect(() => {
    loadSchemas();
  }, [loadSchemas]);

  useEffect(() => {
    if (formKey) loadViews(formKey);
  }, [formKey, loadViews]);

  const updateConfig = (next: ViewConfig) => {
    setConfigObj(next);
    setConfigText(toJsonText(next));
  };

  const handleConfigText = (text: string) => {
    setConfigText(text);
    setTested(false);
    try {
      const parsed = parseJson(text) as ViewConfig;
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.mappings)) {
        setConfigObj(parsed);
      }
    } catch {
      // 输入过程允许暂时非法
    }
  };

  const handleGenerate = async () => {
    if (!formKey) {
      message.warning('请先选择表单');
      return;
    }
    if (!docText.trim()) {
      message.warning('请粘贴下游文档');
      return;
    }
    setGenerating(true);
    try {
      const data = await generateViewMapping(docText, formKey);
      setWarnings(data.warnings || []);
      setConfigObj(data.mapping);
      setConfigText(toJsonText(data.mapping));
      setResult(null);
      setTested(false);
      message.success('已生成映射草案，请检查后发布');
    } catch {
      // API 层已提示
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    let config: ViewConfig;
    try {
      config = parseJson(configText) as ViewConfig;
    } catch (err) {
      message.error(`映射 JSON 解析失败：${(err as Error).message}`);
      return;
    }
    if (!config?.viewKey) {
      message.error('viewKey 必填');
      return;
    }
    setPublishing(true);
    try {
      const published = await publishView(config.viewKey, config);
      setWarnings(published.warnings || []);
      message.success(`发布成功，版本 v${published.version}`);
      loadViews(formKey);
    } catch {
      // API 层已提示
    } finally {
      setPublishing(false);
    }
  };

  const handleTest = async () => {
    if (!configObj?.viewKey) {
      message.warning('请先生成或加载视图映射');
      return;
    }
    setTesting(true);
    try {
      const payload: { recordId?: number; sampleData?: Record<string, unknown> } = {};
      if (recordId.trim()) {
        payload.recordId = Number(recordId);
      } else if (sampleText.trim()) {
        payload.sampleData = parseJson(sampleText) as Record<string, unknown>;
      } else {
        message.warning('请输入记录 ID 或样例数据 JSON');
        return;
      }
      setResult(await testView(configObj.viewKey, payload));
      setTested(true);
      setActiveTab('result');
    } catch (err) {
      if (err instanceof SyntaxError) message.error(`样例数据 JSON 非法：${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const loadVersion = async (viewKey: string) => {
    setVersionKey(viewKey);
    setVersionOpen(true);
    try {
      setVersions(await listViewVersions(viewKey));
    } catch {
      setVersions([]);
    }
  };

  const handleRollback = async (version: number) => {
    try {
      const data = await rollbackView(versionKey, version);
      message.success(`已前滚发布 v${version} 的内容（新版本 v${data.version}）`);
      setVersionOpen(false);
      loadViews(formKey);
    } catch {
      // API 层已提示
    }
  };

  const handleDelete = (viewKey: string) => {
    Modal.confirm({
      title: `删除视图 ${viewKey}？`,
      content: '将删除全部历史版本，不可恢复。',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteView(viewKey);
          message.success('已删除');
          loadViews(formKey);
        } catch {
          // API 层已提示
        }
      },
    });
  };

  const updateMapping = (index: number, patch: Partial<MappingItem>) => {
    if (!configObj) return;
    updateConfig({
      ...configObj,
      mappings: configObj.mappings.map((item, idx) =>
        idx === index ? { ...item, ...patch } : item,
      ),
    });
  };

  const removeMapping = (index: number) => {
    if (!configObj) return;
    updateConfig({
      ...configObj,
      mappings: configObj.mappings.filter((_item, idx) => idx !== index),
    });
  };

  const addMapping = () => {
    if (!configObj) return;
    updateConfig({
      ...configObj,
      mappings: [
        ...configObj.mappings,
        { from: '$.data.', to: '', type: 'string' },
      ],
    });
  };

  const resultRows = useMemo(() => {
    if (!result) return [];
    return [result.transformed];
  }, [result]);

  const resultColumns = useMemo(() => {
    const keys: string[] = [];
    resultRows.forEach((row) => Object.keys(row).forEach((key) => {
      if (!keys.includes(key)) keys.push(key);
    }));
    return keys.map((key) => ({
      title: key,
      dataIndex: key,
      key,
      render: (value: unknown) =>
        value === null || value === undefined ? (
          <Text type="secondary">(MISSING)</Text>
        ) : typeof value === 'object' ? (
          <Text code>{JSON.stringify(value)}</Text>
        ) : (
          String(value)
        ),
    }));
  }, [resultRows]);

  return (
    <AppShell>
      <SchemaErrorBoundary>
        <div style={{ padding: '24px 32px' }}>
          <Card
            title="视图映射（AI 驱动下游适配）"
            extra={
              <Space wrap>
                <Select
                  style={{ width: 260 }}
                  placeholder="选择表单"
                  value={formKey || undefined}
                  onChange={(value) => setFormKey(value)}
                  options={schemas.map((item) => ({
                    label: `${item.title}（${item.formKey}）`,
                    value: item.formKey,
                  }))}
                />
                <Button icon={<HistoryOutlined />} disabled={!configObj} onClick={() => configObj && loadVersion(configObj.viewKey)}>
                  版本
                </Button>
                <Button
                  icon={<ExperimentOutlined />}
                  loading={testing}
                  onClick={handleTest}
                  disabled={!configObj}
                >
                  测试分发
                </Button>
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  loading={publishing}
                  onClick={handlePublish}
                  disabled={!configText || !tested}
                  title={tested ? undefined : '请先通过「测试分发」'}
                >
                  发布
                </Button>
              </Space>
            }
          >
            <Row gutter={16}>
              <Col span={10}>
                <Card size="small" title="下游文档 / 接口说明" style={{ height: '100%' }}>
                  <TextArea
                    value={docText}
                    onChange={(event) => setDocText(event.target.value)}
                    placeholder="粘贴下游接口文档、字段说明或样例报文，AI 将据此生成 JsonPath 映射…"
                    autoSize={{ minRows: 12, maxRows: 18 }}
                  />
                  <Button
                    type="primary"
                    style={{ marginTop: 12 }}
                    icon={<ThunderboltOutlined />}
                    loading={generating}
                    onClick={handleGenerate}
                  >
                    AI 生成映射
                  </Button>
                </Card>
              </Col>
              <Col span={14}>
                <Card
                  size="small"
                  title={
                    <Space>
                      <span>映射编辑</span>
                      {configObj ? <Tag color="blue">{configObj.viewKey}</Tag> : null}
                    </Space>
                  }
                  extra={
                    <Button size="small" icon={<PlusOutlined />} onClick={addMapping} disabled={!configObj}>
                      添加映射
                    </Button>
                  }
                >
                  {warnings.length ? (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginBottom: 8 }}
                      message="校验提示"
                      description={
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      }
                    />
                  ) : null}
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                      {
                        key: 'mapping',
                        label: '结构化编辑',
                        children: configObj ? (
                          <Table<MappingItem>
                            size="small"
                            rowKey={(_row, index) => String(index)}
                            dataSource={configObj.mappings}
                            pagination={false}
                            scroll={{ x: 620, y: 260 }}
                            columns={[
                              {
                                title: 'from（JsonPath）',
                                dataIndex: 'from',
                                width: 220,
                                render: (value: string, _row, index) => (
                                  <Input
                                    size="small"
                                    value={value || ''}
                                    placeholder="$.data.xxx"
                                    onChange={(event) => updateMapping(index, { from: event.target.value })}
                                  />
                                ),
                              },
                              {
                                title: 'to',
                                dataIndex: 'to',
                                width: 160,
                                render: (value: string, _row, index) => (
                                  <Input
                                    size="small"
                                    value={value || ''}
                                    onChange={(event) => updateMapping(index, { to: event.target.value })}
                                  />
                                ),
                              },
                              {
                                title: 'type',
                                dataIndex: 'type',
                                width: 130,
                                render: (value: MappingType, _row, index) => (
                                  <Select
                                    size="small"
                                    value={value}
                                    style={{ width: '100%' }}
                                    options={MAPPING_TYPES.map((type) => ({ label: type, value: type }))}
                                    onChange={(next) => updateMapping(index, { type: next })}
                                  />
                                ),
                              },
                              {
                                title: '高级',
                                key: 'extra',
                                render: (_value, row) => (
                                  <Text type="secondary" style={{ fontSize: 11 }}>
                                    {[
                                      row.enumMap ? 'enumMap' : '',
                                      row.enumDefault ? 'enumDefault' : '',
                                      row.format ? 'format' : '',
                                      row.scale !== undefined && row.scale !== null ? 'scale' : '',
                                      row.value !== undefined ? 'const' : '',
                                      row.itemMappings?.length ? `items×${row.itemMappings.length}` : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' · ') || '-'}
                                  </Text>
                                ),
                              },
                              {
                                title: '',
                                key: 'op',
                                width: 50,
                                render: (_value, _row, index) => (
                                  <Button
                                    type="text"
                                    danger
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    onClick={() => removeMapping(index)}
                                  />
                                ),
                              },
                            ]}
                          />
                        ) : (
                          <Empty description="点击「AI 生成映射」或直接粘贴映射 JSON" />
                        ),
                      },
                      {
                        key: 'json',
                        label: 'JSON',
                        children: (
                          <TextArea
                            value={configText}
                            onChange={(event) => handleConfigText(event.target.value)}
                            autoSize={{ minRows: 16, maxRows: 24 }}
                            style={{ fontFamily: 'Menlo, Consolas, monospace', fontSize: 12 }}
                            placeholder="完整视图配置 JSON（viewKey/title/formKey/mappings）"
                          />
                        ),
                      },
                      {
                        key: 'result',
                        label: '测试结果',
                        children: (
                          <div>
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Space wrap>
                                <Input
                                  style={{ width: 160 }}
                                  placeholder="记录 ID（优先）"
                                  value={recordId}
                                  onChange={(event) => setRecordId(event.target.value)}
                                />
                                <Button size="small" loading={testing} onClick={handleTest}>
                                  执行测试
                                </Button>
                              </Space>
                              <TextArea
                                value={sampleText}
                                onChange={(event) => setSampleText(event.target.value)}
                                placeholder='或粘贴样例数据 JSON（字段对象，例如 {"orderStatus":"pending"}）'
                                autoSize={{ minRows: 4, maxRows: 8 }}
                              />
                              {result ? (
                                <>
                                  {result.warnings.length ? (
                                    <Alert
                                      type="warning"
                                      showIcon
                                      message="转换告警"
                                      description={result.warnings.join('；')}
                                    />
                                  ) : null}
                                  <Table
                                    size="small"
                                    rowKey={() => 'row'}
                                    columns={resultColumns}
                                    dataSource={resultRows}
                                    pagination={false}
                                    scroll={{ x: 'max-content' }}
                                  />
                                  <Paragraph>
                                    <Text type="secondary">输入：</Text>
                                    <pre style={{ maxHeight: 160, overflow: 'auto' }}>
                                      {JSON.stringify(result.input, null, 2)}
                                    </pre>
                                  </Paragraph>
                                </>
                              ) : (
                                <Empty description="尚未执行测试" />
                              )}
                            </Space>
                          </div>
                        ),
                      },
                    ]}
                  />
                </Card>
              </Col>
            </Row>
          </Card>

          <Card
            size="small"
            title={`已有视图${formKey ? `（${formKey}）` : ''}`}
            style={{ marginTop: 16 }}
          >
            <Table<ViewVersion>
              size="small"
              rowKey={(record) => `${record.viewKey}-${record.version}`}
              dataSource={views}
              pagination={false}
              columns={[
                { title: 'viewKey', dataIndex: 'viewKey', width: 220 },
                { title: '标题', dataIndex: 'title' },
                { title: 'formKey', dataIndex: 'formKey', width: 180 },
                {
                  title: '版本',
                  dataIndex: 'version',
                  width: 80,
                  render: (version: number) => <Tag color="blue">v{version}</Tag>,
                },
                { title: '更新时间', dataIndex: 'updatedAt', width: 200 },
                {
                  title: '操作',
                  key: 'action',
                  width: 220,
                  render: (_value, record) => (
                    <Space>
                      <a
                        onClick={() => {
                          setConfigObj(record.mapping);
                          setConfigText(toJsonText(record.mapping));
                          setWarnings(record.warnings || []);
                          setTested(false);
                          setActiveTab('mapping');
                        }}
                      >
                        加载
                      </a>
                      <a onClick={() => loadVersion(record.viewKey)}>版本</a>
                      <a onClick={() => handleDelete(record.viewKey)} style={{ color: '#ff4d4f' }}>
                        删除
                      </a>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </div>

        <Modal
          open={versionOpen}
          title={`版本历史 · ${versionKey}`}
          footer={null}
          width={900}
          onCancel={() => setVersionOpen(false)}
        >
          <Table<ViewVersion>
            size="small"
            rowKey="version"
            dataSource={versions}
            pagination={false}
            columns={[
              { title: '版本', dataIndex: 'version', render: (version: number) => `v${version}` },
              { title: '标题', dataIndex: 'title' },
              { title: '更新时间', dataIndex: 'updatedAt' },
              {
                title: '操作',
                key: 'op',
                render: (_value, record) => (
                  <Space>
                    <a onClick={() => handleRollback(record.version)}>回滚（前滚发布）</a>
                  </Space>
                ),
              },
            ]}
          />
        </Modal>
      </SchemaErrorBoundary>
    </AppShell>
  );
}
