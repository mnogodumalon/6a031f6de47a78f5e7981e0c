import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Reisepakete, Unterkuenfte, Ausfluege, Reisebuchung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [reisepakete, setReisepakete] = useState<Reisepakete[]>([]);
  const [unterkuenfte, setUnterkuenfte] = useState<Unterkuenfte[]>([]);
  const [ausfluege, setAusfluege] = useState<Ausfluege[]>([]);
  const [reisebuchung, setReisebuchung] = useState<Reisebuchung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [reisepaketeData, unterkuenfteData, ausfluegeData, reisebuchungData] = await Promise.all([
        LivingAppsService.getReisepakete(),
        LivingAppsService.getUnterkuenfte(),
        LivingAppsService.getAusfluege(),
        LivingAppsService.getReisebuchung(),
      ]);
      setReisepakete(reisepaketeData);
      setUnterkuenfte(unterkuenfteData);
      setAusfluege(ausfluegeData);
      setReisebuchung(reisebuchungData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [reisepaketeData, unterkuenfteData, ausfluegeData, reisebuchungData] = await Promise.all([
          LivingAppsService.getReisepakete(),
          LivingAppsService.getUnterkuenfte(),
          LivingAppsService.getAusfluege(),
          LivingAppsService.getReisebuchung(),
        ]);
        setReisepakete(reisepaketeData);
        setUnterkuenfte(unterkuenfteData);
        setAusfluege(ausfluegeData);
        setReisebuchung(reisebuchungData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const reisepaketeMap = useMemo(() => {
    const m = new Map<string, Reisepakete>();
    reisepakete.forEach(r => m.set(r.record_id, r));
    return m;
  }, [reisepakete]);

  const unterkuenfteMap = useMemo(() => {
    const m = new Map<string, Unterkuenfte>();
    unterkuenfte.forEach(r => m.set(r.record_id, r));
    return m;
  }, [unterkuenfte]);

  const ausfluegeMap = useMemo(() => {
    const m = new Map<string, Ausfluege>();
    ausfluege.forEach(r => m.set(r.record_id, r));
    return m;
  }, [ausfluege]);

  return { reisepakete, setReisepakete, unterkuenfte, setUnterkuenfte, ausfluege, setAusfluege, reisebuchung, setReisebuchung, loading, error, fetchAll, reisepaketeMap, unterkuenfteMap, ausfluegeMap };
}