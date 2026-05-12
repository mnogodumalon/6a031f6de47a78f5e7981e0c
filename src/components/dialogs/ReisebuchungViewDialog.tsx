import type { Reisebuchung, Reisepakete, Unterkuenfte, Ausfluege } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface ReisebuchungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Reisebuchung | null;
  onEdit: (record: Reisebuchung) => void;
  reisepaketeList: Reisepakete[];
  unterkuenfteList: Unterkuenfte[];
  ausfluegeList: Ausfluege[];
}

export function ReisebuchungViewDialog({ open, onClose, record, onEdit, reisepaketeList, unterkuenfteList, ausfluegeList }: ReisebuchungViewDialogProps) {
  function getReisepaketeDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return reisepaketeList.find(r => r.record_id === id)?.fields.paket_name ?? '—';
  }

  function getUnterkuenfteDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return unterkuenfteList.find(r => r.record_id === id)?.fields.hotelname ?? '—';
  }

  function getAusfluegeDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return ausfluegeList.find(r => r.record_id === id)?.fields.ausflug_name ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reisebuchung anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vorname des Kunden</Label>
            <p className="text-sm">{record.fields.kunde_vorname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nachname des Kunden</Label>
            <p className="text-sm">{record.fields.kunde_nachname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Buchungsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.buchungsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Reisepaket</Label>
            <p className="text-sm">{getReisepaketeDisplayName(record.fields.reisepaket)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Unterkunft</Label>
            <p className="text-sm">{getUnterkuenfteDisplayName(record.fields.unterkunft)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anzahl Erwachsene</Label>
            <p className="text-sm">{record.fields.anzahl_erwachsene ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anzahl Kinder</Label>
            <p className="text-sm">{record.fields.anzahl_kinder ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Abreisedatum</Label>
            <p className="text-sm">{formatDate(record.fields.abreisedatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Rückreisedatum</Label>
            <p className="text-sm">{formatDate(record.fields.rueckreisedatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Reisedauer (Nächte)</Label>
            <p className="text-sm">{record.fields.reisedauer_naechte ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Verpflegung</Label>
            <Badge variant="secondary">{record.fields.verpflegung?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Reiserücktrittsversicherung</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.reiseruecktrittsversicherung ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.reiseruecktrittsversicherung ? 'Ja' : 'Nein'}
            </span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zusatzausflüge</Label>
            <p className="text-sm">{getAusfluegeDisplayName(record.fields.zusatzausfluege)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Paketpreis Erwachsene (€)</Label>
            <p className="text-sm">{record.fields.paketpreis_erwachsene ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Paketpreis Kinder (€)</Label>
            <p className="text-sm">{record.fields.paketpreis_kinder ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Unterkunftskosten (€)</Label>
            <p className="text-sm">{record.fields.unterkunftskosten ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Verpflegungskosten (€)</Label>
            <p className="text-sm">{record.fields.verpflegungskosten ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kurtaxe (€)</Label>
            <p className="text-sm">{record.fields.kurtaxe ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ausflüge Summe (€)</Label>
            <p className="text-sm">{record.fields.ausfluege_summe ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Versicherungskosten (€)</Label>
            <p className="text-sm">{record.fields.versicherungskosten ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Frühbucher-Rabatt (€)</Label>
            <p className="text-sm">{record.fields.fruehbucher_rabatt ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Netto Gesamt (€)</Label>
            <p className="text-sm">{record.fields.netto_gesamt ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">MwSt-Betrag (€)</Label>
            <p className="text-sm">{record.fields.mwst_betrag ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Brutto Gesamt (€)</Label>
            <p className="text-sm">{record.fields.brutto_gesamt ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anzahlung (€, 20% von Brutto)</Label>
            <p className="text-sm">{record.fields.anzahlung ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}