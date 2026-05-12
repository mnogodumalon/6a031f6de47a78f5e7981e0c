import { useState, useEffect, useRef, useCallback } from 'react';
import type { Reisebuchung, Reisepakete, Unterkuenfte, Ausfluege } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi, getUserProfile } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { IconArrowBigDownLinesFilled, IconCamera, IconCircleCheck, IconClipboard, IconFileText, IconLoader2, IconPhotoPlus, IconSparkles, IconUpload, IconX } from '@tabler/icons-react';
import { fileToDataUri, extractFromInput, extractPhotoMeta, reverseGeocode } from '@/lib/ai';
import { lookupKey } from '@/lib/formatters';

interface ReisebuchungDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Reisebuchung['fields']) => Promise<void>;
  defaultValues?: Reisebuchung['fields'];
  reisepaketeList: Reisepakete[];
  unterkuenfteList: Unterkuenfte[];
  ausfluegeList: Ausfluege[];
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

export function ReisebuchungDialog({ open, onClose, onSubmit, defaultValues, reisepaketeList, unterkuenfteList, ausfluegeList, enablePhotoScan = true, enablePhotoLocation = true }: ReisebuchungDialogProps) {
  const [fields, setFields] = useState<Partial<Reisebuchung['fields']>>({});
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [usePersonalInfo, setUsePersonalInfo] = useState(() => {
    try { return localStorage.getItem('ai-use-personal-info') === 'true'; } catch { return false; }
  });
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  useEffect(() => {
    if (open) {
      setFields(defaultValues ?? {});
      setPreview(null);
      setScanSuccess(false);
      setAiText('');
    }
  }, [open, defaultValues]);
  useEffect(() => {
    try { localStorage.setItem('ai-use-personal-info', String(usePersonalInfo)); } catch {}
  }, [usePersonalInfo]);
  async function handleShowProfileInfo() {
    if (showProfileInfo) { setShowProfileInfo(false); return; }
    setProfileLoading(true);
    try {
      const p = await getUserProfile();
      setProfileData(p);
    } catch {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
      setShowProfileInfo(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const clean = cleanFieldsForApi({ ...fields }, 'reisebuchung');
      await onSubmit(clean as Reisebuchung['fields']);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleAiExtract(file?: File) {
    if (!file && !aiText.trim()) return;
    setScanning(true);
    setScanSuccess(false);
    try {
      let uri: string | undefined;
      let gps: { latitude: number; longitude: number } | null = null;
      let geoAddr = '';
      const parts: string[] = [];
      if (file) {
        const [dataUri, meta] = await Promise.all([fileToDataUri(file), extractPhotoMeta(file)]);
        uri = dataUri;
        if (file.type.startsWith('image/')) setPreview(uri);
        gps = enablePhotoLocation ? meta?.gps ?? null : null;
        if (gps) {
          geoAddr = await reverseGeocode(gps.latitude, gps.longitude);
          parts.push(`Location coordinates: ${gps.latitude}, ${gps.longitude}`);
          if (geoAddr) parts.push(`Reverse-geocoded address: ${geoAddr}`);
        }
        if (meta?.dateTime) {
          parts.push(`Date taken: ${meta.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')}`);
        }
      }
      const contextParts: string[] = [];
      if (parts.length) {
        contextParts.push(`<photo-metadata>\nThe following metadata was extracted from the photo\'s EXIF data:\n${parts.join('\n')}\n</photo-metadata>`);
      }
      contextParts.push(`<available-records field="reisepaket" entity="Reisepakete">\n${JSON.stringify(reisepaketeList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="unterkunft" entity="Unterkünfte">\n${JSON.stringify(unterkuenfteList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="zusatzausfluege" entity="Ausflüge">\n${JSON.stringify(ausfluegeList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      if (usePersonalInfo) {
        try {
          const profile = await getUserProfile();
          contextParts.push(`<user-profile>\nThe following is the logged-in user\'s personal information. Use this to pre-fill relevant fields like name, email, address, company etc. when appropriate:\n${JSON.stringify(profile, null, 2)}\n</user-profile>`);
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      }
      const photoContext = contextParts.length ? contextParts.join('\n') : undefined;
      const schema = `{\n  "kunde_vorname": string | null, // Vorname des Kunden\n  "kunde_nachname": string | null, // Nachname des Kunden\n  "buchungsdatum": string | null, // YYYY-MM-DD\n  "reisepaket": string | null, // Display name from Reisepakete (see <available-records>)\n  "unterkunft": string | null, // Display name from Unterkünfte (see <available-records>)\n  "anzahl_erwachsene": number | null, // Anzahl Erwachsene\n  "anzahl_kinder": number | null, // Anzahl Kinder\n  "abreisedatum": string | null, // YYYY-MM-DD\n  "rueckreisedatum": string | null, // YYYY-MM-DD\n  "reisedauer_naechte": number | null, // Reisedauer (Nächte)\n  "verpflegung": LookupValue | null, // Verpflegung (select one key: "ohne" | "fruehstueck" | "halbpension" | "vollpension") mapping: ohne=Ohne, fruehstueck=Frühstück, halbpension=Halbpension, vollpension=Vollpension\n  "reiseruecktrittsversicherung": boolean | null, // Reiserücktrittsversicherung\n  "zusatzausfluege": string | null, // Display name from Ausflüge (see <available-records>)\n  "paketpreis_erwachsene": number | null, // Paketpreis Erwachsene (€)\n  "paketpreis_kinder": number | null, // Paketpreis Kinder (€)\n  "unterkunftskosten": number | null, // Unterkunftskosten (€)\n  "verpflegungskosten": number | null, // Verpflegungskosten (€)\n  "kurtaxe": number | null, // Kurtaxe (€)\n  "ausfluege_summe": number | null, // Ausflüge Summe (€)\n  "versicherungskosten": number | null, // Versicherungskosten (€)\n  "fruehbucher_rabatt": number | null, // Frühbucher-Rabatt (€)\n  "netto_gesamt": number | null, // Netto Gesamt (€)\n  "mwst_betrag": number | null, // MwSt-Betrag (€)\n  "brutto_gesamt": number | null, // Brutto Gesamt (€)\n  "anzahlung": number | null, // Anzahlung (€, 20% von Brutto)\n}`;
      const raw = await extractFromInput<Record<string, unknown>>(schema, {
        dataUri: uri,
        userText: aiText.trim() || undefined,
        photoContext,
        intent: DIALOG_INTENT,
      });
      setFields(prev => {
        const merged = { ...prev } as Record<string, unknown>;
        function matchName(name: string, candidates: string[]): boolean {
          const n = name.toLowerCase().trim();
          return candidates.some(c => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
        }
        const applookupKeys = new Set<string>(["reisepaket", "unterkunft", "zusatzausfluege"]);
        for (const [k, v] of Object.entries(raw)) {
          if (applookupKeys.has(k)) continue;
          if (v != null) merged[k] = v;
        }
        const reisepaketName = raw['reisepaket'] as string | null;
        if (reisepaketName) {
          const reisepaketMatch = reisepaketeList.find(r => matchName(reisepaketName!, [String(r.fields.paket_name ?? '')]));
          if (reisepaketMatch) merged['reisepaket'] = createRecordUrl(APP_IDS.REISEPAKETE, reisepaketMatch.record_id);
        }
        const unterkunftName = raw['unterkunft'] as string | null;
        if (unterkunftName) {
          const unterkunftMatch = unterkuenfteList.find(r => matchName(unterkunftName!, [String(r.fields.hotelname ?? '')]));
          if (unterkunftMatch) merged['unterkunft'] = createRecordUrl(APP_IDS.UNTERKUENFTE, unterkunftMatch.record_id);
        }
        const zusatzausfluegeName = raw['zusatzausfluege'] as string | null;
        if (zusatzausfluegeName) {
          const zusatzausfluegeMatch = ausfluegeList.find(r => matchName(zusatzausfluegeName!, [String(r.fields.ausflug_name ?? '')]));
          if (zusatzausfluegeMatch) merged['zusatzausfluege'] = createRecordUrl(APP_IDS.AUSFLUEGE, zusatzausfluegeMatch.record_id);
        }
        return merged as Partial<Reisebuchung['fields']>;
      });
      setAiText('');
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 3000);
    } catch (err) {
      console.error('Scan fehlgeschlagen:', err);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleAiExtract(f);
    e.target.value = '';
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      handleAiExtract(file);
    }
  }, []);

  const DIALOG_INTENT = defaultValues ? 'Reisebuchung bearbeiten' : 'Reisebuchung hinzufügen';

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{DIALOG_INTENT}</DialogTitle>
        </DialogHeader>

        {enablePhotoScan && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div>
              <div className="flex items-center gap-1.5 font-medium">
                <IconSparkles className="h-4 w-4 text-primary" />
                KI-Assistent
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Versteht Fotos, Dokumente und Text und füllt alles für dich aus</p>
            </div>
            <div className="flex items-start gap-2 pl-0.5">
              <Checkbox
                id="ai-use-personal-info"
                checked={usePersonalInfo}
                onCheckedChange={(v) => setUsePersonalInfo(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                <Label htmlFor="ai-use-personal-info" className="text-xs font-normal text-muted-foreground cursor-pointer inline">
                  KI-Assistent darf zusätzlich Informationen zu meiner Person verwenden
                </Label>
                {' '}
                <button type="button" onClick={handleShowProfileInfo} className="text-xs text-primary hover:underline whitespace-nowrap">
                  {profileLoading ? 'Lade...' : '(mehr Infos)'}
                </button>
              </span>
            </div>
            {showProfileInfo && (
              <div className="rounded-md border bg-muted/50 p-2 text-xs max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">Folgende Infos über dich können von der KI genutzt werden:</p>
                {profileData ? Object.values(profileData).map((v, i) => (
                  <span key={i}>{i > 0 && ", "}{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                )) : (
                  <span className="text-muted-foreground">Profil konnte nicht geladen werden</span>
                )}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !scanning && fileInputRef.current?.click()}
              className={`
                relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${scanning
                  ? 'border-primary/40 bg-primary/5'
                  : scanSuccess
                    ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20'
                    : dragOver
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconLoader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">KI analysiert...</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Felder werden automatisch ausgefüllt</p>
                  </div>
                </div>
              ) : scanSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <IconCircleCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Felder ausgefüllt!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Prüfe die Werte und passe sie ggf. an</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/8 flex items-center justify-center">
                    <IconPhotoPlus className="h-7 w-7 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Foto oder Dokument hierher ziehen oder auswählen</p>
                  </div>
                </div>
              )}

              {preview && !scanning && (
                <div className="absolute top-2 right-2">
                  <div className="relative group">
                    <img src={preview} alt="" className="h-10 w-10 rounded-md object-cover border shadow-sm" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreview(null); }}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted-foreground/80 text-white flex items-center justify-center"
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                <IconCamera className="h-3.5 w-3.5 mr-1" />Kamera
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <IconUpload className="h-3.5 w-3.5 mr-1" />Foto wählen
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => {
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'application/pdf,.pdf';
                    fileInputRef.current.click();
                    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.accept = 'image/*,application/pdf'; }, 100);
                  }
                }}>
                <IconFileText className="h-3.5 w-3.5 mr-1" />Dokument
              </Button>
            </div>

            <div className="relative">
              <Textarea
                placeholder="Text eingeben oder einfügen, z.B. Notizen, E-Mails, Beschreibungen..."
                value={aiText}
                onChange={e => {
                  setAiText(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(Math.max(el.scrollHeight, 56), 96) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && aiText.trim() && !scanning) {
                    e.preventDefault();
                    handleAiExtract();
                  }
                }}
                disabled={scanning}
                rows={2}
                className="pr-12 resize-none text-sm overflow-y-auto"
              />
              <button
                type="button"
                className="absolute right-2 top-2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                disabled={scanning}
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setAiText(prev => prev ? prev + '\n' + text : text);
                  } catch {}
                }}
                title="Paste"
              >
                <IconClipboard className="h-4 w-4" />
              </button>
            </div>
            {aiText.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                disabled={scanning}
                onClick={() => handleAiExtract()}
              >
                <IconSparkles className="h-3.5 w-3.5 mr-1.5" />Analysieren
              </Button>
            )}
            <div className="flex justify-center pt-1">
              <IconArrowBigDownLinesFilled className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kunde_vorname">Vorname des Kunden</Label>
            <Input
              id="kunde_vorname"
              value={fields.kunde_vorname ?? ''}
              onChange={e => setFields(f => ({ ...f, kunde_vorname: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kunde_nachname">Nachname des Kunden</Label>
            <Input
              id="kunde_nachname"
              value={fields.kunde_nachname ?? ''}
              onChange={e => setFields(f => ({ ...f, kunde_nachname: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buchungsdatum">Buchungsdatum</Label>
            <Input
              id="buchungsdatum"
              type="date"
              value={fields.buchungsdatum ?? ''}
              onChange={e => setFields(f => ({ ...f, buchungsdatum: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reisepaket">Reisepaket</Label>
            <Select
              value={extractRecordId(fields.reisepaket) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, reisepaket: v === 'none' ? undefined : createRecordUrl(APP_IDS.REISEPAKETE, v) }))}
            >
              <SelectTrigger id="reisepaket"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {reisepaketeList.map(r => (
                  <SelectItem key={r.record_id} value={r.record_id}>
                    {r.fields.paket_name ?? r.record_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="unterkunft">Unterkunft</Label>
            <Select
              value={extractRecordId(fields.unterkunft) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, unterkunft: v === 'none' ? undefined : createRecordUrl(APP_IDS.UNTERKUENFTE, v) }))}
            >
              <SelectTrigger id="unterkunft"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {unterkuenfteList.map(r => (
                  <SelectItem key={r.record_id} value={r.record_id}>
                    {r.fields.hotelname ?? r.record_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="anzahl_erwachsene">Anzahl Erwachsene</Label>
            <Input
              id="anzahl_erwachsene"
              type="number"
              value={fields.anzahl_erwachsene ?? ''}
              onChange={e => setFields(f => ({ ...f, anzahl_erwachsene: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="anzahl_kinder">Anzahl Kinder</Label>
            <Input
              id="anzahl_kinder"
              type="number"
              value={fields.anzahl_kinder ?? ''}
              onChange={e => setFields(f => ({ ...f, anzahl_kinder: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abreisedatum">Abreisedatum</Label>
            <Input
              id="abreisedatum"
              type="date"
              value={fields.abreisedatum ?? ''}
              onChange={e => setFields(f => ({ ...f, abreisedatum: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rueckreisedatum">Rückreisedatum</Label>
            <Input
              id="rueckreisedatum"
              type="date"
              value={fields.rueckreisedatum ?? ''}
              onChange={e => setFields(f => ({ ...f, rueckreisedatum: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reisedauer_naechte">Reisedauer (Nächte)</Label>
            <Input
              id="reisedauer_naechte"
              type="number"
              value={fields.reisedauer_naechte ?? ''}
              onChange={e => setFields(f => ({ ...f, reisedauer_naechte: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="verpflegung">Verpflegung</Label>
            <Select
              value={lookupKey(fields.verpflegung) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, verpflegung: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="verpflegung"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="ohne">Ohne</SelectItem>
                <SelectItem value="fruehstueck">Frühstück</SelectItem>
                <SelectItem value="halbpension">Halbpension</SelectItem>
                <SelectItem value="vollpension">Vollpension</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reiseruecktrittsversicherung">Reiserücktrittsversicherung</Label>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="reiseruecktrittsversicherung"
                checked={!!fields.reiseruecktrittsversicherung}
                onCheckedChange={(v) => setFields(f => ({ ...f, reiseruecktrittsversicherung: !!v }))}
              />
              <Label htmlFor="reiseruecktrittsversicherung" className="font-normal">Reiserücktrittsversicherung</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="zusatzausfluege">Zusatzausflüge</Label>
            <Select
              value={extractRecordId(fields.zusatzausfluege) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, zusatzausfluege: v === 'none' ? undefined : createRecordUrl(APP_IDS.AUSFLUEGE, v) }))}
            >
              <SelectTrigger id="zusatzausfluege"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {ausfluegeList.map(r => (
                  <SelectItem key={r.record_id} value={r.record_id}>
                    {r.fields.ausflug_name ?? r.record_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="paketpreis_erwachsene">Paketpreis Erwachsene (€)</Label>
            <Input
              id="paketpreis_erwachsene"
              type="number"
              value={fields.paketpreis_erwachsene ?? ''}
              onChange={e => setFields(f => ({ ...f, paketpreis_erwachsene: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paketpreis_kinder">Paketpreis Kinder (€)</Label>
            <Input
              id="paketpreis_kinder"
              type="number"
              value={fields.paketpreis_kinder ?? ''}
              onChange={e => setFields(f => ({ ...f, paketpreis_kinder: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unterkunftskosten">Unterkunftskosten (€)</Label>
            <Input
              id="unterkunftskosten"
              type="number"
              value={fields.unterkunftskosten ?? ''}
              onChange={e => setFields(f => ({ ...f, unterkunftskosten: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="verpflegungskosten">Verpflegungskosten (€)</Label>
            <Input
              id="verpflegungskosten"
              type="number"
              value={fields.verpflegungskosten ?? ''}
              onChange={e => setFields(f => ({ ...f, verpflegungskosten: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kurtaxe">Kurtaxe (€)</Label>
            <Input
              id="kurtaxe"
              type="number"
              value={fields.kurtaxe ?? ''}
              onChange={e => setFields(f => ({ ...f, kurtaxe: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ausfluege_summe">Ausflüge Summe (€)</Label>
            <Input
              id="ausfluege_summe"
              type="number"
              value={fields.ausfluege_summe ?? ''}
              onChange={e => setFields(f => ({ ...f, ausfluege_summe: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="versicherungskosten">Versicherungskosten (€)</Label>
            <Input
              id="versicherungskosten"
              type="number"
              value={fields.versicherungskosten ?? ''}
              onChange={e => setFields(f => ({ ...f, versicherungskosten: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fruehbucher_rabatt">Frühbucher-Rabatt (€)</Label>
            <Input
              id="fruehbucher_rabatt"
              type="number"
              value={fields.fruehbucher_rabatt ?? ''}
              onChange={e => setFields(f => ({ ...f, fruehbucher_rabatt: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="netto_gesamt">Netto Gesamt (€)</Label>
            <Input
              id="netto_gesamt"
              type="number"
              value={fields.netto_gesamt ?? ''}
              onChange={e => setFields(f => ({ ...f, netto_gesamt: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mwst_betrag">MwSt-Betrag (€)</Label>
            <Input
              id="mwst_betrag"
              type="number"
              value={fields.mwst_betrag ?? ''}
              onChange={e => setFields(f => ({ ...f, mwst_betrag: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brutto_gesamt">Brutto Gesamt (€)</Label>
            <Input
              id="brutto_gesamt"
              type="number"
              value={fields.brutto_gesamt ?? ''}
              onChange={e => setFields(f => ({ ...f, brutto_gesamt: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="anzahlung">Anzahlung (€, 20% von Brutto)</Label>
            <Input
              id="anzahlung"
              type="number"
              value={fields.anzahlung ?? ''}
              onChange={e => setFields(f => ({ ...f, anzahlung: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Speichern...' : defaultValues ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}