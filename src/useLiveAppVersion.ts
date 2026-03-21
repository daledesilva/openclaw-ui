import { useEffect, useState } from 'react';
import { VITE_APP_VERSION_FULL } from './appVersion';
import { OPENCLAW_APP_VERSION_HMR_EVENT } from './versionHmrEvent';

/** Version from `virtual:app-version`; in dev, updates when build rev bumps (custom HMR from the Vite plugin). */
export function useLiveAppVersion(): string {
  const [version, setVersion] = useState(VITE_APP_VERSION_FULL);

  useEffect(() => {
    if (!import.meta.hot) return;
    const handler = (data: { full?: string }) => {
      if (typeof data?.full === 'string') setVersion(data.full);
    };
    import.meta.hot.on(OPENCLAW_APP_VERSION_HMR_EVENT, handler);
    return () => import.meta.hot?.off(OPENCLAW_APP_VERSION_HMR_EVENT, handler);
  }, []);

  return version;
}
