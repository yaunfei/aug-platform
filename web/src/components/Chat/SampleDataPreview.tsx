import { Table, Typography } from 'antd';
import React, { useMemo } from 'react';

const { Text } = Typography;

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** 样例数据预览：列取所有行 key 的并集。 */
export function SampleDataPreview({ data }: { data: Record<string, unknown>[] }) {
  const columns = useMemo(() => {
    const keys: string[] = [];
    data.forEach((row) => {
      Object.keys(row || {}).forEach((key) => {
        if (!keys.includes(key)) keys.push(key);
      });
    });
    return keys.map((key) => ({
      title: key,
      dataIndex: key,
      key,
      ellipsis: true,
      render: (value: unknown) => <Text ellipsis>{stringify(value)}</Text>,
    }));
  }, [data]);

  return (
    <Table
      size="small"
      rowKey={(_, index) => String(index)}
      columns={columns}
      dataSource={data}
      pagination={false}
      scroll={{ x: 'max-content' }}
    />
  );
}
