import {
  AppstoreAddOutlined,
  CodeOutlined,
  RedoOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { BetaSchemaForm } from '@ant-design/pro-components';
import { Button, Card, Drawer, Empty, Space, Tooltip, Typography } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ColumnSchema, FormSchema } from '@/types/schema';
import { hydrateColumns } from '@/utils/hydrateColumns';
import { FieldEditorModal } from './FieldEditorModal';
import { SortableColumnTree } from './SortableColumnTree';
import {
  type EditorColumn,
  cloneColumns,
  ensureUids,
  locateColumn,
  moveColumn,
  nextUid,
  stripUids,
} from './columnTreeUtils';

const { Text } = Typography;

interface Props {
  open: boolean;
  schema: FormSchema | null;
  onChange: (schema: FormSchema) => void;
  onClose: () => void;
}

interface ModalState {
  open: boolean;
  mode: 'add' | 'edit';
  initial?: EditorColumn | null;
  parentUid: string | null;
}

function removeNode(columns: EditorColumn[], uid: string): EditorColumn[] {
  return columns
    .filter((column) => column._uid !== uid)
    .map((column) =>
      column.columns
        ? { ...column, columns: removeNode(column.columns as EditorColumn[], uid) }
        : column,
    );
}

function replaceNode(
  columns: EditorColumn[],
  uid: string,
  next: ColumnSchema,
): EditorColumn[] {
  return columns.map((column) => {
    if (column._uid === uid) {
      return { ...next, _uid: uid, columns: column.columns } as EditorColumn;
    }
    if (column.columns) {
      return { ...column, columns: replaceNode(column.columns as EditorColumn[], uid, next) };
    }
    return column;
  });
}

function appendNode(
  columns: EditorColumn[],
  parentUid: string | null,
  column: EditorColumn,
): EditorColumn[] {
  if (!parentUid) return [...columns, column];
  return columns.map((item) => {
    if (item._uid === parentUid) {
      return { ...item, columns: [...((item.columns || []) as EditorColumn[]), column] };
    }
    if (item.columns) {
      return {
        ...item,
        columns: appendNode(item.columns as EditorColumn[], parentUid, column),
      };
    }
    return item;
  });
}

export function VisualEditor({ open, schema, onChange, onClose }: Props) {
  const [columns, setColumns] = useState<EditorColumn[]>(() => ensureUids(schema?.columns));
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'add', parentUid: null });
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 });
  const past = useRef<EditorColumn[][]>([]);
  const future = useRef<EditorColumn[][]>([]);
  const lastEmit = useRef('');

  const emit = useCallback(
    (next: EditorColumn[]) => {
      if (!schema) return;
      const stripped = stripUids(next);
      const serialized = JSON.stringify(stripped);
      if (serialized === lastEmit.current) return;
      lastEmit.current = serialized;
      onChange({ ...schema, columns: stripped });
    },
    [schema, onChange],
  );

  const commit = useCallback(
    (next: EditorColumn[]) => {
      past.current.push(cloneColumns(columns));
      future.current = [];
      setColumns(next);
      setHistorySize({ past: past.current.length, future: 0 });
      emit(next);
    },
    [columns, emit],
  );

  // 父级（JSON 直编）修改时反向同步；lastEmit 防循环
  useEffect(() => {
    if (!schema) return;
    const serialized = JSON.stringify(schema.columns || []);
    if (serialized === lastEmit.current) return;
    const next = ensureUids(schema.columns);
    lastEmit.current = serialized;
    past.current = [];
    future.current = [];
    setColumns(next);
    setHistorySize({ past: 0, future: 0 });
  }, [schema]);

  useEffect(() => {
    if (columns.length && !lastEmit.current) {
      lastEmit.current = JSON.stringify(stripUids(columns));
    }
  }, [columns]);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(cloneColumns(columns));
    setColumns(previous);
    setHistorySize({ past: past.current.length, future: future.current.length });
    emit(previous);
  }, [columns, emit]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(cloneColumns(columns));
    setColumns(next);
    setHistorySize({ past: past.current.length, future: future.current.length });
    emit(next);
  }, [columns, emit]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, undo, redo]);

  const handleMove = (activeId: string, overId: string) => {
    // 中间态不写入历史，dragEnd 才 commit
    const next = moveColumn(columns, activeId, overId);
    if (next !== columns) commit(next);
  };

  const handleSubmit = (column: ColumnSchema, uid?: string) => {
    if (uid) {
      commit(replaceNode(columns, uid, column));
    } else {
      const withUid = { ...column, _uid: nextUid() } as EditorColumn;
      commit(appendNode(columns, modal.parentUid, withUid));
    }
    setModal((prev) => ({ ...prev, open: false }));
  };

  const previewColumns = hydrateColumns(stripUids(columns), { mode: 'form' });

  return (
    <Drawer
      open={open}
      width={1120}
      title="可视化调整"
      onClose={onClose}
      destroyOnClose
      styles={{ body: { padding: 16 } }}
      extra={
        <Space>
          <Tooltip title="撤销（Ctrl/Cmd+Z）">
            <Button icon={<UndoOutlined />} onClick={undo} disabled={!historySize.past} />
          </Tooltip>
          <Tooltip title="重做（Ctrl/Cmd+Shift+Z）">
            <Button icon={<RedoOutlined />} onClick={redo} disabled={!historySize.future} />
          </Tooltip>
        </Space>
      }
    >
      <div style={{ display: 'flex', gap: 16, height: '100%' }}>
        <Card
          title="字段结构树"
          size="small"
          style={{ width: '46%', overflow: 'auto' }}
          extra={
            <Space>
              <Button
                size="small"
                icon={<AppstoreAddOutlined />}
                onClick={() => setModal({ open: true, mode: 'add', parentUid: null })}
              >
                字段
              </Button>
              <Button
                size="small"
                icon={<CodeOutlined />}
                onClick={() =>
                  setModal({ open: true, mode: 'add', parentUid: null, initial: { valueType: 'group' } as any })
                }
              >
                分组
              </Button>
              <Button
                size="small"
                onClick={() =>
                  setModal({ open: true, mode: 'add', parentUid: null, initial: { valueType: 'formList' } as any })
                }
              >
                明细列表
              </Button>
            </Space>
          }
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            容器（group/formList）只能存在于顶层；拖拽调整字段顺序与归属。
          </Text>
          <div style={{ marginTop: 12 }}>
            <SortableColumnTree
              columns={columns}
              onMove={handleMove}
              onEdit={(column) =>
                setModal({
                  open: true,
                  mode: 'edit',
                  initial: column,
                  parentUid: locateColumn(columns, column._uid)?.parentUid ?? null,
                })
              }
              onDelete={(uid) => commit(removeNode(columns, uid))}
              onAddChild={(parentUid) =>
                setModal({ open: true, mode: 'add', parentUid })
              }
            />
          </div>
        </Card>

        <Card title="实时预览" size="small" style={{ flex: 1, overflow: 'auto' }}>
          {columns.length ? (
            <BetaSchemaForm
              layoutType="Form"
              layout="vertical"
              columns={previewColumns as any}
              submitter={false}
            />
          ) : (
            <Empty description="暂无字段" />
          )}
        </Card>
      </div>

      <FieldEditorModal
        open={modal.open}
        mode={modal.mode}
        initial={modal.initial}
        columns={columns}
        parentUid={modal.parentUid}
        onSubmit={handleSubmit}
        onCancel={() => setModal((prev) => ({ ...prev, open: false }))}
      />
    </Drawer>
  );
}
