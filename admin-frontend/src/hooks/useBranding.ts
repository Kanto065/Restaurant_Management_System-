import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Branding {
  name: string;
  logoUrl: string | null;
  storefrontUrl: string | null;
}

/**
 * The restaurant that owns the domain this dashboard is served from (same build serves
 * admin.porttennanttandoori.co.uk, admin.starspicetumble.co.uk, ...). Anonymous, so the
 * login page can show it too. Also keeps the browser tab title in sync.
 */
export function useBranding() {
  const { data } = useQuery({
    queryKey: ['public', 'branding'],
    queryFn: () => api.get<Branding>('/api/public/branding'),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const branding = data?.data;
  const name = branding?.name ?? 'Restaurant Admin';

  useEffect(() => {
    document.title = branding?.name ? `${branding.name} — Admin` : 'Restaurant Admin';
  }, [branding?.name]);

  return {
    name,
    logoUrl: branding?.logoUrl ?? null,
    // Env override kept for local dev, where the admin runs on localhost with no domain row.
    storefrontUrl: import.meta.env.VITE_STOREFRONT_BASE_URL ?? branding?.storefrontUrl ?? window.location.origin,
  };
}
