import type { Ausfluege } from '@/types/app';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { IconPencil } from '@tabler/icons-react';

interface AusfluegeViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Ausfluege | null;
  onEdit: (record: Ausfluege) => void;
}

export function AusfluegeViewDialog({ open, onClose, record, onEdit }: AusfluegeViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ausflüge anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Name des Ausflugs</Label>
            <p className="text-sm">{record.fields.ausflug_name ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Preis pro Person (€)</Label>
            <p className="text-sm">{record.fields.preis_pro_person ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Dauer (Stunden)</Label>
            <p className="text-sm">{record.fields.dauer_stunden ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}