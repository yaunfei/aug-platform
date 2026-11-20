import { DeleteOutlined, EditOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Empty, Tag, Tooltip, Typography } from 'antd';
import React from 'react';
import type { EditorColumn } from './columnTreeUtils';
import { isContainer } from './columnTreeUtils';

const { Text } = Typography;

interface TreeProps {
  columns: EditorColumn[];
  onMove: (activeId: string, overId: string) => void;
  onEdit: (column: EditorColumn) => void;
  onDelete: (uid: string) => void;
  onAddChild: (parentUid: string) => void;
}

const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  const collisions = pointer.length ? pointer : rectIntersection(args);
  if (!collisions.length) return [];
  const kindOf = (id: string | number) => {
    const container = args.droppableContainers.find((item) => item.id === id);
    return (container?.data?.current as { kind?: string } | undefined)?.kind;
  };
  // 优先普通字段 → 容器放置区 → 容器节点
  const field = collisions.find((item) => kindOf(item.id) === 'field');
  if (field) return [field];
  const dropZone = collisions.find((item) => kindOf(item.id) === 'container-drop');
  if (dropZone) return [dropZone];
  const container = collisions.find((item) => kindOf(item.id) === 'container');
  return container ? [container] : [collisions[0]];
};

interface ItemProps {
  column: EditorColumn;
  onEdit: (column: EditorColumn) => void;
  onDelete: (uid: string) => void;
  onAddChild: (parentUid: string) => void;
}

function FieldRow({ column, onEdit, onDelete, isTopLevel }: ItemProps & { isTopLevel?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `field:${column._uid}`,
    data: { kind: 'field' },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        marginBottom: 6,
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 6,
        cursor: 'pointer',
      }}
      onClick={() => onEdit(column)}
    >
      <span
        {...attributes}
        {...listeners}
        onClick={(event) => event.stopPropagation()}
        style={{ cursor: 'grab', color: '#999' }}
      >
        <HolderOutlined />
      </span>
      <Tag color={isTopLevel ? 'blue' : 'default'} style={{ marginInlineEnd: 0 }}>
        {column.valueType}
      </Tag>
      <Text ellipsis style={{ flex: 1 }}>
        {column.title || column.dataIndex}
      </Text>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {column.dataIndex}
      </Text>
      <Tooltip title="删除字段">
        <a
          onClick={(event) => {
            event.stopPropagation();
            onDelete(column._uid);
          }}
          style={{ color: '#ff4d4f' }}
        >
          <DeleteOutlined />
        </a>
      </Tooltip>
    </div>
  );
}

function ContainerRow({ column, onEdit, onDelete, onAddChild }: ItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `container:${column._uid}`, data: { kind: 'container' } });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `container-drop:${column._uid}`,
    data: { kind: 'container-drop' },
  });
  const children = (column.columns || []) as EditorColumn[];
  const childIds = children.map((child) => `field:${child._uid}`);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        border: `1px solid ${isOver ? '#1677ff' : '#e5e7eb'}`,
        borderRadius: 8,
        marginBottom: 10,
        background: '#fafafa',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', color: '#999' }}
        >
          <HolderOutlined />
        </span>
        <Tag color={column.valueType === 'group' ? 'purple' : 'orange'}>
          {column.valueType}
        </Tag>
        <Text strong style={{ flex: 1 }}>
          {column.title || column.dataIndex}
        </Text>
        <Button
          size="small"
          type="link"
          icon={<PlusOutlined />}
          onClick={() => onAddChild(column._uid)}
        >
          子字段
        </Button>
        <Button size="small" type="link" icon={<EditOutlined />} onClick={() => onEdit(column)}>
          编辑
        </Button>
        <Button
          size="small"
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onDelete(column._uid)}
        >
          删除
        </Button>
      </div>

      <div ref={setDropRef} style={{ padding: 10, minHeight: 64 }}>
        <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
          {children.map((child) => (
            <FieldRow
              key={child._uid}
              column={child}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </SortableContext>
        {!children.length ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            将字段拖入此处，或点击「子字段」添加
          </Text>
        ) : null}
      </div>
    </div>
  );
}

export function SortableColumnTree({ columns, onMove, onEdit, onDelete, onAddChild }: TreeProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    onMove(String(active.id), String(over.id));
  };

  const topIds = columns.map((column) =>
    isContainer(column) ? `container:${column._uid}` : `field:${column._uid}`,
  );

  if (!columns.length) {
    return <Empty description="暂无字段，点击上方按钮添加" />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={topIds} strategy={verticalListSortingStrategy}>
        {columns.map((column) =>
          isContainer(column) ? (
            <ContainerRow
              key={column._uid}
              column={column}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ) : (
            <FieldRow
              key={column._uid}
              column={column}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              isTopLevel
            />
          ),
        )}
      </SortableContext>
    </DndContext>
  );
}
