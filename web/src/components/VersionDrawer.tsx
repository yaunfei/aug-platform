import { DiffOutlined, EyeOutlined, RollbackOutlined } from '@ant-design/icons';
import { Button, Drawer, Empty, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { listSchemaVersions, rollbackSchema } from '@/services/api';
import type { SchemaVersion } from '@/types/schema';
import { diffStat, jsonDiff } from '@/utils/jsonDiff';

const { Text } = Typography;

interface Props {
  open: boolean;
  formKey: string;
  onClose: () => void;
  onChanged?: () => void;
}

export function VersionDrawer({ open, formKey, onClose, onChanged }: Props) {
  const [versions, setVersions] = useState<SchemaVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<SchemaVersion | null>(null);
  const [leftVersion, setLeftVersion] = useState<number>();
  const [rightVersion, setRightVersion] = useState<number>();
  const [diffLines, setDiffLines] = useState<ReturnType<typeof jsonDiff> | null>(null);

  const load = useCallback(() => {
    if (!formKey) return;
    setLoading(true);
    listSchemaVersions(formKey)
      .then((data) => {
        setVersions(data);
        setLeftVersion((prev) => prev ?? data[data.length - 1]?.version);
        setRightVersion((prev) => prev ?? data[0]?.version);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [formKey]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const options = versions.map((item) => ({
    label: `v${item.version}（${item.createdAt}）`,
    value: item.version,
  }));

  const compare = () => {
    const left = versions.find((item) => item.version === leftVersion);
    const right = versions.find((item) => item.version === rightVersion);
    if (!left || !right) {
      message.warning('请选择两个版本');
      return;
    }
    setDiffLines(jsonDiff(left.schema, right.schema));
  };

  const handleRollback = async (version: number) => {
    try {
      await rollbackSchema(formKey, version);
      message.success(`已前滚发布 v${version} 的内容`);
      setDiffLines(null);
      load();
      onChanged?.();
    } catch {
      // API 层已提示
    }
  };

  const stat = useMemo(() => (diffLines ? diffStat(diffLines) : null), [diffLines]);

  return (
    <>
      <Drawer open={open} title={`版本历史 · ${formKey}`} width={960} onClose={onClose} destroyOnClose>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            style={{ width: 260 }}
            placeholder="旧版本"
            value={leftVersion}
            options={options}
            onChange={setLeftVersion}
          />
          <Select
            style={{ width: 260 }}
            placeholder="新版本"
            value={rightVersion}
            options={options}
            onChange={setRightVersion}
          />
          <Button icon={<DiffOutlined />} onClick={compare}>
            对比
          </Button>
          {stat ? (
            <Text type="secondary">
              <Text type="success">+{stat.added}</Text> / <Text type="danger">-{stat.removed}</Text>
            </Text>
          ) : null}
        </Space>

        <Table<SchemaVersion>
          rowKey="version"
          size="small"
          loading={loading}
          dataSource={versions}
          pagination={false}
          columns={[
            {
              title: '版本',
              dataIndex: 'version',
              render: (version: number) => <Tag color="blue">v{version}</Tag>,
            },
            { title: '标题', dataIndex: 'title' },
            { title: '发布时间', dataIndex: 'createdAt' },
            {
              title: '操作',
              key: 'action',
              width: 200,
              render: (_value, record) => (
                <Space>
                  <a onClick={() => setPreview(record)}>
                    <EyeOutlined /> 查看
                  </a>
                  <Popconfirm
                    title={`将 v${record.version} 的内容发布为新版本？`}
                    description="前滚式回滚：历史版本不会被改写"
                    onConfirm={() => handleRollback(record.version)}
                  >
                    <a>
                      <RollbackOutlined /> 回滚
                    </a>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />

        {diffLines ? (
          <div
            style={{
              marginTop: 20,
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              maxHeight: 420,
              overflow: 'auto',
              background: '#fafafa',
              fontFamily: 'Menlo, Consolas, monospace',
              fontSize: 12,
              lineHeight: '20px',
            }}
          >
            {diffLines.map((line, index) => (
              <div
                key={`${line.type}-${index}`}
                style={{
                  padding: '0 12px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  background:
                    line.type === 'add' ? '#e6ffec' : line.type === 'remove' ? '#ffebe9' : 'transparent',
                  color: line.type === 'add' ? '#116329' : line.type === 'remove' ? '#a40e26' : '#555',
                }}
              >
                {line.type === 'add' ? '+ ' : line.type === 'remove' ? '- ' : '  '}
                {line.text || ' '}
              </div>
            ))}
          </div>
        ) : (
          <Empty style={{ marginTop: 32 }} description="选择两个版本后点击对比" />
        )}
      </Drawer>

      <Modal
        open={Boolean(preview)}
        title={preview ? `${formKey} v${preview.version}` : ''}
        width={880}
        footer={null}
        onCancel={() => setPreview(null)}
      >
        <pre
          style={{
            maxHeight: '65vh',
            overflow: 'auto',
            background: '#fafafa',
            padding: 16,
            borderRadius: 8,
          }}
        >
          {preview ? JSON.stringify(preview.schema, null, 2) : ''}
        </pre>
      </Modal>
    </>
  );
}
