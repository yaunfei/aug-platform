import { useParams } from '@umijs/max';
import React from 'react';
import { AppShell } from '@/components/AppShell';
import { DynamicListPage } from '@/components/DynamicListPage';
import { SchemaErrorBoundary } from '@/components/SchemaErrorBoundary';

export default function DynamicFormPage() {
  const { formKey } = useParams<{ formKey: string }>();
  if (!formKey) return null;
  return (
    <AppShell>
      <SchemaErrorBoundary>
        <DynamicListPage key={formKey} formKey={formKey} />
      </SchemaErrorBoundary>
    </AppShell>
  );
}
