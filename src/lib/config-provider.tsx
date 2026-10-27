'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ConfigErrorScreen } from '@/components/config/config-error-screen';
import { FullPageLoader } from '@/components/common/full-page-loader';
import { ConnectPolicy } from '@/components/security/connect-policy';
import { ConfigError, loadConfig, type AppConfig } from '@/lib/config';

type ConfigState =
  | { status: 'loading' }
  | { status: 'ready'; config: AppConfig }
  | { status: 'error'; error: ConfigError };

const ConfigContext = createContext<AppConfig | null>(null);

/** Nothing below this provider renders until config.json is loaded and valid. */
export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfigState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    loadConfig(controller.signal).then(
      (config) => setState({ status: 'ready', config }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          error:
            error instanceof ConfigError
              ? error
              : new ConfigError('Something unexpected went wrong while loading config.json.'),
        });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  if (state.status === 'loading') return <FullPageLoader label="Loading configuration" />;
  if (state.status === 'error') return <ConfigErrorScreen error={state.error} onRetry={retry} />;
  return (
    <ConfigContext.Provider value={state.config}>
      <ConnectPolicy apiBaseUrl={state.config.apiBaseUrl} />
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): AppConfig {
  const config = useContext(ConfigContext);
  if (!config) throw new Error('useConfig must be used inside ConfigProvider');
  return config;
}
