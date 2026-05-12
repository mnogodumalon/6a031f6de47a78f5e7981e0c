import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { lookupKey } from '@/lib/formatters';

// Empty PROXY_BASE → relative URLs (dashboard and form-proxy share the domain).
const PROXY_BASE = '';
const APP_ID = '6a031f549b19e27808c3cc43';
const SUBMIT_PATH = `/rest/apps/${APP_ID}/records`;
const ALTCHA_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/altcha/dist/altcha.min.js';

async function submitPublicForm(fields: Record<string, unknown>, captchaToken: string) {
  const res = await fetch(`${PROXY_BASE}/api${SUBMIT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Captcha-Token': captchaToken,
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Submission failed');
  }
  return res.json();
}


function cleanFields(fields: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value) && 'key' in (value as any)) {
      cleaned[key] = (value as any).key;
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map(item =>
        typeof item === 'object' && item !== null && 'key' in item ? item.key : item
      );
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export default function PublicFormReisebuchung() {
  const [fields, setFields] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captchaRef = useRef<HTMLElement | null>(null);

  // Load the ALTCHA web component script once per page.
  useEffect(() => {
    if (document.querySelector(`script[src="${ALTCHA_SCRIPT_SRC}"]`)) return;
    const s = document.createElement('script');
    s.src = ALTCHA_SCRIPT_SRC;
    s.defer = true;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx === -1) return;
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    const prefill: Record<string, any> = {};
    params.forEach((value, key) => { prefill[key] = value; });
    if (Object.keys(prefill).length) setFields(prev => ({ ...prefill, ...prev }));
  }, []);

  function readCaptchaToken(): string | null {
    const el = captchaRef.current as any;
    if (!el) return null;
    return el.value || el.getAttribute('value') || null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = readCaptchaToken();
    if (!token) {
      setError('Bitte warte auf die Spam-Prüfung und versuche es erneut.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitPublicForm(cleanFields(fields), token);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Vielen Dank!</h2>
          <p className="text-muted-foreground">Deine Eingabe wurde erfolgreich übermittelt.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setSubmitted(false); setFields({}); }}>
            Weitere Eingabe
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Reisebuchung — Formular</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6 shadow-md">
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

          <altcha-widget
            ref={captchaRef as any}
            challengeurl={`${PROXY_BASE}/api/_challenge?path=${encodeURIComponent(SUBMIT_PATH)}`}
            auto="onsubmit"
            hidefooter
          />

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Wird gesendet...' : 'Absenden'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Powered by Klar
        </p>
      </div>
    </div>
  );
}
