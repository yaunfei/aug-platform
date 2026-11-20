import { fetchComponents } from '@/services/api';
import { registerComponents } from '@/utils/hydrateColumns';

/** 渲染前拉取组件注册表，动态注册前端白名单；失败静默回退内置白名单。 */
export async function render(oldRender: () => void): Promise<void> {
  try {
    const components = await fetchComponents();
    registerComponents(components);
  } catch {
    // 后端未启动时沿用内置 11 个基础组件
  }
  oldRender();
}
