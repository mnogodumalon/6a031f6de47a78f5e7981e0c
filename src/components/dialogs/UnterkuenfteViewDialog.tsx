import type { Unterkuenfte } from '@/types/app';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { IconPencil } from '@tabler/icons-react';

interface UnterkuenfteViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Unterkuenfte | null;
  onEdit: (record: Unterkuenfte) => void;
}

export function UnterkuenfteViewDialog({ open, onClose, record, onEdit }: UnterkuenfteViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Unterkünfte anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hotelname</Label>
            <p className="text-sm">{record.fields.hotelname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sterne (1–5)</Label>
            <p className="text-sm">{record.fields.sterne ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Preis pro Nacht (€)</Label>
            <p className="text-sm">{record.fields.preis_pro_nacht ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kurtaxe pro Person/Nacht (€)</Label>
            <p className="text-sm">{record.fields.kurtaxe_pro_person_nacht ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}