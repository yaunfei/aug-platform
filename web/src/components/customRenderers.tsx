import { UploadOutlined } from '@ant-design/icons';
import { Button, Checkbox, Image, Input, Radio, Space, Tag, Upload, message } from 'antd';
import type { UploadFile } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { uploadFile } from '@/services/api';

const PEOPLE_OPTIONS = [
  { label: '用户标签', value: 'dmp' },
  { label: '人群包', value: 'package' },
  { label: '所有用户', value: 'allUsers' },
];

const PEOPLE_LABELS: Record<string, string> = {
  dmp: '用户标签',
  package: '人群包',
  allUsers: '所有用户',
};

function asText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function maskPhone(value: unknown): string {
  const text = asText(value);
  if (/^\d{11}$/.test(text)) return text.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
  return text;
}

interface FieldComponentProps {
  value?: unknown;
  onChange?: (value: unknown) => void;
  placeholder?: string;
  maxSizeMB?: number;
  accept?: string;
}

function UploadField({ value, onChange, placeholder, maxSizeMB = 5, accept }: FieldComponentProps) {
  const [uploading, setUploading] = useState(false);

  const beforeUpload = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      message.error(`文件不能超过 ${maxSizeMB}MB`);
      return false;
    }
    setUploading(true);
    try {
      const result = await uploadFile(file);
      onChange?.(result.url);
      message.success('上传成功');
    } catch {
      // 错误已由 API 层提示
    } finally {
      setUploading(false);
    }
    return false;
  };

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input
        value={asText(value)}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder || '粘贴素材 URL 或点击右侧上传'}
        allowClear
      />
      <Upload showUploadList={false} accept={accept} beforeUpload={beforeUpload}>
        <Button icon={<UploadOutlined />} loading={uploading}>
          上传
        </Button>
      </Upload>
    </Space.Compact>
  );
}

function ImageUploadField({ value, onChange, maxSizeMB = 5 }: FieldComponentProps) {
  const [uploading, setUploading] = useState(false);
  const fileList: UploadFile[] = value
    ? [{ uid: '-1', name: 'image', status: 'done', url: asText(value) }]
    : [];

  const beforeUpload = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      message.error(`图片不能超过 ${maxSizeMB}MB`);
      return false;
    }
    setUploading(true);
    try {
      const result = await uploadFile(file);
      onChange?.(result.url);
    } catch {
      // 错误已由 API 层提示
    } finally {
      setUploading(false);
    }
    return false;
  };

  return (
    <Upload
      listType="picture-card"
      accept="image/png,image/jpeg,image/webp"
      fileList={fileList}
      onRemove={() => onChange?.('')}
      beforeUpload={beforeUpload}
      showUploadList={{ showPreviewIcon: true, showRemoveIcon: true }}
      disabled={uploading}
    >
      {value ? null : <div>{uploading ? '上传中…' : '+ 上传'}</div>}
    </Upload>
  );
}

function PagPreview({ url, width = 72, height = 72 }: { url: string; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!url) return;
      try {
        const mod = await import('libpag-lite');
        const buffer = await fetch(url).then((resp) => resp.arrayBuffer());
        if (cancelled || !canvasRef.current) return;
        const PAGView = (mod as any).PAGView;
        const types = (mod as any).types;
        viewRef.current?.destroy?.();
        viewRef.current = PAGView.init(buffer, canvasRef.current, {
          renderingMode: types?.RenderingMode?.WebGL,
        });
      } catch {
        if (!cancelled) setError(true);
      }
    };
    load();
    return () => {
      cancelled = true;
      viewRef.current?.destroy?.();
      viewRef.current = null;
    };
  }, [url]);

  if (!url) return <span>-</span>;
  if (error) return <Tag>{url.split('/').pop()}</Tag>;
  return (
    <span
      onMouseEnter={() => viewRef.current?.play?.()}
      onMouseLeave={() => viewRef.current?.pause?.()}
      title="悬停预览 PAG 动效"
      style={{ display: 'inline-block', border: '1px solid #f0f0f0', borderRadius: 4 }}
    >
      <canvas ref={canvasRef} width={width} height={height} />
    </span>
  );
}

function PagUploadField({ value, onChange, placeholder, maxSizeMB = 5 }: FieldComponentProps) {
  const [uploading, setUploading] = useState(false);

  const beforeUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pag')) {
      message.error('仅支持 .pag 动效文件');
      return false;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      message.error(`文件不能超过 ${maxSizeMB}MB`);
      return false;
    }
    setUploading(true);
    try {
      const result = await uploadFile(file);
      onChange?.(result.url);
    } catch {
      // 错误已由 API 层提示
    } finally {
      setUploading(false);
    }
    return false;
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={asText(value)}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder || '粘贴 .pag 文件 URL 或点击上传'}
          allowClear
        />
        <Upload showUploadList={false} accept=".pag" beforeUpload={beforeUpload}>
          <Button icon={<UploadOutlined />} loading={uploading}>
            上传
          </Button>
        </Upload>
      </Space.Compact>
      {value ? <PagPreview url={asText(value)} /> : null}
    </Space>
  );
}

function PeopleGroupField({ value, onChange, mode }: FieldComponentProps & { mode?: 'radio' | 'checkbox' }) {
  if (mode === 'checkbox') {
    return (
      <Checkbox.Group
        options={PEOPLE_OPTIONS}
        value={(Array.isArray(value) ? value : value ? [value] : []) as string[]}
        onChange={(next) => onChange?.(next)}
      />
    );
  }
  return (
    <Radio.Group
      options={PEOPLE_OPTIONS}
      value={asText(value)}
      onChange={(event) => onChange?.(event.target.value)}
    />
  );
}

export interface CustomRenderer {
  render?: (dom: React.ReactNode, record: Record<string, unknown>, index: number, action: unknown, schema: Record<string, unknown>) => React.ReactNode;
  renderFormItem?: (schema: any, config: any, form: any) => React.ReactNode;
}

function fieldPropsOf(schema: any): Record<string, unknown> {
  return (schema?.fieldProps || {}) as Record<string, unknown>;
}

export const CUSTOM_RENDERERS: Record<string, CustomRenderer> = {
  phone: {
    render: (dom) => maskPhone(dom),
    renderFormItem: (schema) => (
      <Input
        placeholder={asText(fieldPropsOf(schema).placeholder) || '请输入 11 位手机号'}
        maxLength={11}
        allowClear
      />
    ),
  },
  imageUpload: {
    render: (dom) =>
      dom ? <Image src={asText(dom)} width={48} height={48} style={{ objectFit: 'cover' }} /> : '-',
    renderFormItem: (schema) => (
      <ImageUploadField maxSizeMB={Number(fieldPropsOf(schema).maxSizeMB) || 5} />
    ),
  },
  pagUpload: {
    render: (dom) => <PagPreview url={asText(dom)} />,
    renderFormItem: (schema) => (
      <PagUploadField
        placeholder={asText(fieldPropsOf(schema).placeholder)}
        maxSizeMB={Number(fieldPropsOf(schema).maxSizeMB) || 5}
      />
    ),
  },
  inputUpload: {
    render: (dom) => (dom ? <a href={asText(dom)} target="_blank" rel="noreferrer">{asText(dom)}</a> : '-'),
    renderFormItem: (schema) => (
      <UploadField
        placeholder={asText(fieldPropsOf(schema).placeholder)}
        maxSizeMB={Number(fieldPropsOf(schema).maxSizeMB) || 5}
        accept="image/png,image/jpeg,image/webp,.pag"
      />
    ),
  },
  peopleGroup: {
    render: (dom) => {
      const values = Array.isArray(dom) ? dom : dom ? [dom] : [];
      if (!values.length) return '-';
      return (
        <Space size={4} wrap>
          {values.map((item: unknown) => (
            <Tag key={asText(item)}>{PEOPLE_LABELS[asText(item)] || asText(item)}</Tag>
          ))}
        </Space>
      );
    },
    renderFormItem: (schema) => (
      <PeopleGroupField mode={fieldPropsOf(schema).mode === 'checkbox' ? 'checkbox' : 'radio'} />
    ),
  },
};
