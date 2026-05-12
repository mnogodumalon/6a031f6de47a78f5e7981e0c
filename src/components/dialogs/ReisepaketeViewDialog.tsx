import type { Reisepakete } from '@/types/app';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { IconPencil } from '@tabler/icons-react';

interface ReisepaketeViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Reisepakete | null;
  onEdit: (record: Reisepakete) => void;
}

export function ReisepaketeViewDialog({ open, onClose, record, onEdit }: ReisepaketeViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reisepakete anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Name des Reisepakets</Label>
            <p className="text-sm">{record.fields.paket_name ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zielort</Label>
            <p className="text-sm">{record.fields.zielort ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Basispreis pro Erwachsenem (€)</Label>
            <p className="text-sm">{record.fields.basispreis_erwachsener ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kinder-Faktor (0.5–1.0)</Label>
            <p className="text-sm">{record.fields.kinder_faktor ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Mindestteilnehmer</Label>
            <p className="text-sm">{record.fields.mindestteilnehmer ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}