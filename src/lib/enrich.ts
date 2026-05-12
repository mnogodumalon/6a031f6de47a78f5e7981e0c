import type { EnrichedReisebuchung } from '@/types/enriched';
import type { Ausfluege, Reisebuchung, Reisepakete, Unterkuenfte } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface ReisebuchungMaps {
  reisepaketeMap: Map<string, Reisepakete>;
  unterkuenfteMap: Map<string, Unterkuenfte>;
  ausfluegeMap: Map<string, Ausfluege>;
}

export function enrichReisebuchung(
  reisebuchung: Reisebuchung[],
  maps: ReisebuchungMaps
): EnrichedReisebuchung[] {
  return reisebuchung.map(r => ({
    ...r,
    reisepaketName: resolveDisplay(r.fields.reisepaket, maps.reisepaketeMap, 'paket_name'),
    unterkunftName: resolveDisplay(r.fields.unterkunft, maps.unterkuenfteMap, 'hotelname'),
    zusatzausfluegeName: resolveDisplay(r.fields.zusatzausfluege, maps.ausfluegeMap, 'ausflug_name'),
  }));
}
