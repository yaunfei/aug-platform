import { KeyOutlined } from '@ant-design/icons';
import { history, useLocation } from '@umijs/max';
import { Button, ConfigProvider, Input, Layout, Menu, Modal, Space, Typography, message } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import React, { useEffect, useState } from 'react';

const { Header, Content } = Layout;
const { Text } = Typography;

const MENU_ITEMS = [
  { key: '/schema-generate', label: 'AI 对话生成' },
  { key: '/schema-list', label: 'Schema 管理' },
  { key: '/views', label: '视图映射' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [tokenOpen, setTokenOpen] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    try {
      setToken(localStorage.getItem('apiToken') || '');
    } catch {
      // ignore
    }
  }, []);

  const selectedKey = location.pathname.startsWith('/form/')
    ? ''
    : MENU_ITEMS.find((item) => location.pathname.startsWith(item.key))?.key || '';

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{ token: { colorPrimary: '#1677ff', borderRadius: 8 } }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            background: '#001529',
            padding: '0 24px',
          }}
        >
          <Space>
            <Text strong style={{ color: '#fff', fontSize: 16, whiteSpace: 'nowrap' }}>
              AI Schema 表单平台
            </Text>
          </Space>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={selectedKey ? [selectedKey] : []}
            items={MENU_ITEMS}
            style={{ flex: 1, minWidth: 320, background: 'transparent' }}
            onClick={({ key }) => history.push(key)}
          />
          <Button ghost icon={<KeyOutlined />} onClick={() => setTokenOpen(true)}>
            API Token
          </Button>
        </Header>
        <Content style={{ background: '#f5f7fa', minHeight: 'calc(100vh - 64px)' }}>
          {children}
        </Content>
      </Layout>

      <Modal
        title="设置 API Token"
        open={tokenOpen}
        okText="保存"
        cancelText="取消"
        onCancel={() => setTokenOpen(false)}
        onOk={() => {
          try {
            if (token.trim()) localStorage.setItem('apiToken', token.trim());
            else localStorage.removeItem('apiToken');
          } catch {
            // ignore
          }
          message.success('已保存，后续请求自动携带 Bearer Token');
          setTokenOpen(false);
        }}
      >
        <Input.Password
          placeholder="AUTH_TOKEN（未开启鉴权可留空）"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
      </Modal>
    </ConfigProvider>
  );
}
