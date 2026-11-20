import { defineConfig } from '@umijs/max';

export default defineConfig({
  title: 'AI 驱动 Schema 表单平台',
  npmClient: 'pnpm',
  hash: true,
  history: { type: 'browser' },
  routes: [
    { path: '/', redirect: '/schema-generate' },
    { path: '/schema-generate', component: 'SchemaGenerate' },
    { path: '/schema-list', component: 'SchemaList' },
    { path: '/form/:formKey', component: 'DynamicForm' },
    { path: '/views', component: 'ViewList' },
  ],
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:8100',
      changeOrigin: true,
    },
  },
});
