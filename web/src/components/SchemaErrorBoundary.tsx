import { Button, Result } from 'antd';
import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/** 动态 Schema 渲染错误边界，防止非法字段导致整页白屏。 */
export class SchemaErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    // eslint-disable-next-line no-console
    console.error('[SchemaErrorBoundary]', error);
  }

  render() {
    if (this.state.error) {
      return (
        <Result
          status="error"
          title="页面渲染失败"
          subTitle={this.state.error.message || 'Schema 结构异常，请检查后重试'}
          extra={
            <Button type="primary" onClick={() => this.setState({ error: null })}>
              重试
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}
