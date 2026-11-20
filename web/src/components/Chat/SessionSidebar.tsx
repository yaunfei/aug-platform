import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Empty, List, Popconfirm, Space, Spin, Typography } from 'antd';
import React from 'react';
import type { ChatSession } from '@/types/schema';

const { Text } = Typography;

interface Props {
  sessions: ChatSession[];
  currentKey: string;
  loading?: boolean;
  onNew: () => void;
  onSelect: (session: ChatSession) => void;
  onDelete: (sessionKey: string) => void;
  onRefresh: () => void;
}

export function SessionSidebar({
  sessions,
  currentKey,
  loading,
  onNew,
  onSelect,
  onDelete,
  onRefresh,
}: Props) {
  return (
    <div
      style={{
        width: 240,
        borderRight: '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        background: '#fafafa',
      }}
    >
      <div style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
        <Space.Compact block>
          <Button type="primary" icon={<PlusOutlined />} onClick={onNew} style={{ flex: 1 }}>
            新会话
          </Button>
          <Button icon={<ReloadOutlined />} onClick={onRefresh} title="刷新列表" />
        </Space.Compact>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : sessions.length ? (
          <List
            size="small"
            dataSource={sessions}
            renderItem={(item) => {
              const active = item.sessionKey === currentKey;
              return (
                <div
                  key={item.sessionKey}
                  onClick={() => onSelect(item)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderLeft: `3px solid ${active ? '#1677ff' : 'transparent'}`,
                    background: active ? '#e6f4ff' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <Text ellipsis strong={active} style={{ flex: 1 }}>
                      {item.title || '新会话'}
                    </Text>
                    <Popconfirm
                      title="删除该会话？"
                      onConfirm={(event) => {
                        event?.stopPropagation();
                        onDelete(item.sessionKey);
                      }}
                      onCancel={(event) => event?.stopPropagation()}
                    >
                      <a
                        onClick={(event) => event.stopPropagation()}
                        style={{ color: '#ff4d4f' }}
                        title="删除会话"
                      >
                        <DeleteOutlined />
                      </a>
                    </Popconfirm>
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {item.sessionKey} · {(item.updatedAt || '').replace('T', ' ').slice(5, 16)}
                  </Text>
                </div>
              );
            }}
          />
        ) : (
          <Empty style={{ marginTop: 40 }} description="暂无会话" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </div>
    </div>
  );
}
