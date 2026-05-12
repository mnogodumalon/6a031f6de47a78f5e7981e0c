import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { differenceInDays, format } from 'date-fns';
import type { Reisepakete, Unterkuenfte, Ausfluege } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { useDashboardData } from '@/hooks/useDashboardData';
import { formatCurrency } from '@/lib/formatters';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { BudgetTracker } from '@/components/BudgetTracker';
import { ReisepaketeDialog } from '@/components/dialogs/ReisepaketeDialog';
import { UnterkuenfteDialog } from '@/components/dialogs/UnterkuenfteDialog';
import { AusfluegeDialog } from '@/components/dialogs/AusfluegeDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  IconPackage,
  IconBuilding,
  IconMap2,
  IconCheck,
  IconLoader2,
  IconAlertCircle,
  IconCircleCheck,
  IconArrowRight,
  IconArrowLeft,
  IconRefresh,
  IconHome,
  IconPlus,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Reisepaket' },
  { label: 'Unterkunft' },
  { label: 'Details' },
  { label: 'Preisübersicht' },
  { label: 'Buchung' },
  { label: 'Fertig' },
];

const verpflegungMap: Record<string, number> = {
  ohne: 0,
  fruehstueck: 12,
  halbpension: 25,
  vollpension: 40,
  allinclusive: 60,
};

interface PriceCalc {
  paketPreisErw: number;
  paketPreisKind: number;
  unterkunftskosten: number;
  verpflegungskosten: number;
  kurtaxe: number;
  ausfluege_summe: number;
  versicherungskosten: number;
  fruehbucher_rabatt: number;
  netto_gesamt: number;
  mwst_betrag: number;
  brutto_gesamt: number;
  anzahlung: number;
}

function calcPrice(
  paket: Reisepakete | null,
  unterkunft: Unterkuenfte | null,
  ausflug: Ausfluege | null,
  anzahl_erwachsene: number,
  anzahl_kinder: number,
  abreisedatum: string,
  rueckreisedatum: string,
  verpflegung: string,
  reiseruecktrittsversicherung: boolean,
): PriceCalc {
  const naechte =
    abreisedatum && rueckreisedatum
      ? Math.max(0, differenceInDays(new Date(rueckreisedatum), new Date(abreisedatum)))
      : 0;

  const paketPreisErw = (paket?.fields.basispreis_erwachsener ?? 0) * anzahl_erwachsene;
  const paketPreisKind =
    (paket?.fields.basispreis_erwachsener ?? 0) *
    (paket?.fields.kinder_faktor ?? 0) *
    anzahl_kinder;
  const unterkunftskosten = (unterkunft?.fields.preis_pro_nacht ?? 0) * naechte;
  const gesamtPersonen = anzahl_erwachsene + anzahl_kinder;
  const verpflegungskosten = (verpflegungMap[verpflegung] ?? 0) * gesamtPersonen * naechte;
  const kurtaxe = (unterkunft?.fields.kurtaxe_pro_person_nacht ?? 0) * gesamtPersonen * naechte;
  const ausfluege_summe = ausflug ? (ausflug.fields.preis_pro_person ?? 0) * gesamtPersonen : 0;
  const versicherungskosten = reiseruecktrittsversicherung
    ? (paketPreisErw + paketPreisKind) * 0.03
    : 0;

  const daysTillTrip = abreisedatum
    ? differenceInDays(new Date(abreisedatum), new Date())
    : 0;
  const fruehbucher_rabatt =
    daysTillTrip > 60 ? (paketPreisErw + paketPreisKind) * 0.05 : 0;

  const netto_gesamt =
    paketPreisErw +
    paketPreisKind +
    unterkunftskosten +
    verpflegungskosten +
    kurtaxe +
    ausfluege_summe +
    versicherungskosten -
    fruehbucher_rabatt;
  const mwst_betrag = netto_gesamt * 0.19;
  const brutto_gesamt = netto_gesamt + mwst_betrag;
  const anzahlung = brutto_gesamt * 0.2;

  return {
    paketPreisErw,
    paketPreisKind,
    unterkunftskosten,
    verpflegungskosten,
    kurtaxe,
    ausfluege_summe,
    versicherungskosten,
    fruehbucher_rabatt,
    netto_gesamt,
    mwst_betrag,
    brutto_gesamt,
    anzahlung,
  };
}

function StarDisplay({ count }: { count: number | undefined }) {
  if (!count) return <span className="text-muted-foreground">—</span>;
  return <span className="text-amber-400">{'★'.repeat(Math.min(count, 5))}</span>;
}

function PriceRow({ label, value, highlight, negative }: { label: string; value: number; highlight?: boolean; negative?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-1.5 ${highlight ? 'font-semibold text-foreground' : 'text-sm text-muted-foreground'}`}>
      <span className={negative ? 'text-green-700' : ''}>{label}</span>
      <span className={negative ? 'text-green-700 font-medium' : ''}>{negative && value > 0 ? `- ${formatCurrency(value)}` : formatCurrency(value)}</span>
    </div>
  );
}

export default function NeueReisebuchungPage() {
  const { reisepakete, unterkuenfte, ausfluege, fetchAll, loading, error } = useDashboardData();
  const [searchParams, setSearchParams] = useSearchParams();

  // Wizard step
  const [step, setStep] = useState<number>(() => {
    const s = parseInt(searchParams.get('step') ?? '', 10);
    return s >= 1 && s <= 6 ? s : 1;
  });

  // Selections
  const [selectedPaket, setSelectedPaket] = useState<Reisepakete | null>(null);
  const [selectedUnterkunft, setSelectedUnterkunft] = useState<Unterkuenfte | null>(null);
  const [selectedAusflug, setSelectedAusflug] = useState<Ausfluege | null>(null);

  // Step 3 form state
  const [kundeVorname, setKundeVorname] = useState('');
  const [kundeNachname, setKundeNachname] = useState('');
  const [abreisedatum, setAbreisedatum] = useState('');
  const [rueckreisedatum, setRueckreisedatum] = useState('');
  const [anzahlErwachsene, setAnzahlErwachsene] = useState(2);
  const [anzahlKinder, setAnzahlKinder] = useState(0);
  const [verpflegung, setVerpflegung] = useState('ohne');
  const [reiseruecktrittsversicherung, setReiseruecktrittsversicherung] = useState(false);
  const [step3Error, setStep3Error] = useState<string | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdBrutto, setCreatedBrutto] = useState(0);
  const [createdName, setCreatedName] = useState('');

  // Dialog open states
  const [paketDialogOpen, setPaketDialogOpen] = useState(false);
  const [unterkunftDialogOpen, setUnterkunftDialogOpen] = useState(false);
  const [ausflugDialogOpen, setAusflugDialogOpen] = useState(false);

  // Pre-select paket from URL param ?paketId=xxx
  useEffect(() => {
    const paketId = searchParams.get('paketId');
    if (paketId && reisepakete.length > 0 && !selectedPaket) {
      const found = reisepakete.find(p => p.record_id === paketId);
      if (found) {
        setSelectedPaket(found);
      }
    }
  }, [reisepakete, searchParams, selectedPaket]);

  // Sync step to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (step > 1) {
      params.set('step', String(step));
    } else {
      params.delete('step');
    }
    setSearchParams(params, { replace: true });
  }, [step, searchParams, setSearchParams]);

  const price = useMemo(
    () =>
      calcPrice(
        selectedPaket,
        selectedUnterkunft,
        selectedAusflug,
        anzahlErwachsene,
        anzahlKinder,
        abreisedatum,
        rueckreisedatum,
        verpflegung,
        reiseruecktrittsversicherung,
      ),
    [
      selectedPaket,
      selectedUnterkunft,
      selectedAusflug,
      anzahlErwachsene,
      anzahlKinder,
      abreisedatum,
      rueckreisedatum,
      verpflegung,
      reiseruecktrittsversicherung,
    ],
  );

  const reisedauerNaechte =
    abreisedatum && rueckreisedatum
      ? Math.max(0, differenceInDays(new Date(rueckreisedatum), new Date(abreisedatum)))
      : 0;

  const verpflegungOptions = LOOKUP_OPTIONS.reisebuchung?.verpflegung ?? [];

  function goToStep(n: number) {
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSelectPaket(id: string) {
    const found = reisepakete.find(p => p.record_id === id) ?? null;
    setSelectedPaket(found);
    goToStep(2);
  }

  function handleSelectUnterkunft(id: string) {
    const found = unterkuenfte.find(u => u.record_id === id) ?? null;
    setSelectedUnterkunft(found);
    goToStep(3);
  }

  function validateStep3(): boolean {
    if (!kundeVorname.trim()) {
      setStep3Error('Bitte Vorname eingeben.');
      return false;
    }
    if (!kundeNachname.trim()) {
      setStep3Error('Bitte Nachname eingeben.');
      return false;
    }
    if (!abreisedatum) {
      setStep3Error('Bitte Abreisedatum wählen.');
      return false;
    }
    if (!rueckreisedatum) {
      setStep3Error('Bitte Rückreisedatum wählen.');
      return false;
    }
    if (rueckreisedatum <= abreisedatum) {
      setStep3Error('Das Rückreisedatum muss nach dem Abreisedatum liegen.');
      return false;
    }
    if (anzahlErwachsene < 1) {
      setStep3Error('Mindestens 1 Erwachsener erforderlich.');
      return false;
    }
    setStep3Error(null);
    return true;
  }

  async function handleCreateBuchung() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.createReisebuchungEntry({
        kunde_vorname: kundeVorname.trim(),
        kunde_nachname: kundeNachname.trim(),
        buchungsdatum: format(new Date(), 'yyyy-MM-dd'),
        reisepaket: createRecordUrl(APP_IDS.REISEPAKETE, selectedPaket!.record_id),
        unterkunft: createRecordUrl(APP_IDS.UNTERKUENFTE, selectedUnterkunft!.record_id),
        zusatzausfluege: selectedAusflug
          ? createRecordUrl(APP_IDS.AUSFLUEGE, selectedAusflug.record_id)
          : undefined,
        anzahl_erwachsene: anzahlErwachsene,
        anzahl_kinder: anzahlKinder,
        abreisedatum,
        rueckreisedatum,
        reisedauer_naechte: reisedauerNaechte,
        verpflegung,
        reiseruecktrittsversicherung,
        paketpreis_erwachsene: price.paketPreisErw,
        paketpreis_kinder: price.paketPreisKind,
        unterkunftskosten: price.unterkunftskosten,
        verpflegungskosten: price.verpflegungskosten,
        kurtaxe: price.kurtaxe,
        ausfluege_summe: price.ausfluege_summe,
        versicherungskosten: price.versicherungskosten,
        fruehbucher_rabatt: price.fruehbucher_rabatt,
        netto_gesamt: price.netto_gesamt,
        mwst_betrag: price.mwst_betrag,
        brutto_gesamt: price.brutto_gesamt,
        anzahlung: price.anzahlung,
      });
      setCreatedBrutto(price.brutto_gesamt);
      setCreatedName(`${kundeVorname.trim()} ${kundeNachname.trim()}`);
      await fetchAll();
      goToStep(6);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Anlegen der Buchung.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetWizard() {
    setSelectedPaket(null);
    setSelectedUnterkunft(null);
    setSelectedAusflug(null);
    setKundeVorname('');
    setKundeNachname('');
    setAbreisedatum('');
    setRueckreisedatum('');
    setAnzahlErwachsene(2);
    setAnzahlKinder(0);
    setVerpflegung('ohne');
    setReiseruecktrittsversicherung(false);
    setStep3Error(null);
    setSubmitError(null);
    goToStep(1);
  }

  return (
    <IntentWizardShell
      title="Neue Reisebuchung"
      subtitle="Führe dich Schritt für Schritt durch den Buchungsprozess"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={goToStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Reisepaket wählen ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Reisepaket wählen</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Wähle ein Reisepaket als Basis für die Buchung aus.
            </p>
          </div>
          <EntitySelectStep
            items={reisepakete.map(p => ({
              id: p.record_id,
              title: p.fields.paket_name ?? '(kein Name)',
              subtitle: p.fields.zielort ?? undefined,
              stats: [
                {
                  label: 'Basispreis/Erw.',
                  value: formatCurrency(p.fields.basispreis_erwachsener),
                },
                {
                  label: 'Kinderfaktor',
                  value: p.fields.kinder_faktor != null ? `×${p.fields.kinder_faktor}` : '—',
                },
              ],
              icon: <IconPackage size={20} className="text-primary" />,
            }))}
            onSelect={handleSelectPaket}
            searchPlaceholder="Paket suchen..."
            emptyIcon={<IconPackage size={32} />}
            emptyText="Noch keine Reisepakete vorhanden."
            createLabel="Neues Paket anlegen"
            onCreateNew={() => setPaketDialogOpen(true)}
            createDialog={
              <ReisepaketeDialog
                open={paketDialogOpen}
                onClose={() => setPaketDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createReisepaketeEntry(fields);
                  await fetchAll();
                  setPaketDialogOpen(false);
                }}
                enablePhotoScan={AI_PHOTO_SCAN['Reisepakete']}
                enablePhotoLocation={AI_PHOTO_LOCATION['Reisepakete']}
              />
            }
          />
        </div>
      )}

      {/* ── Step 2: Unterkunft wählen ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Unterkunft wählen</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Wähle die Unterkunft für{' '}
                <span className="font-medium text-foreground">
                  {selectedPaket?.fields.paket_name ?? 'dein Reisepaket'}
                </span>
                .
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => goToStep(1)} className="shrink-0 gap-1">
              <IconArrowLeft size={14} />
              Zurück
            </Button>
          </div>
          <EntitySelectStep
            items={unterkuenfte.map(u => ({
              id: u.record_id,
              title: u.fields.hotelname ?? '(kein Name)',
              subtitle: u.fields.sterne != null ? '★'.repeat(Math.min(u.fields.sterne, 5)) : undefined,
              stats: [
                {
                  label: 'Preis/Nacht',
                  value: u.fields.preis_pro_nacht != null ? `${formatCurrency(u.fields.preis_pro_nacht)}/Nacht` : '—',
                },
                {
                  label: 'Kurtaxe/P./Nacht',
                  value: formatCurrency(u.fields.kurtaxe_pro_person_nacht),
                },
              ],
              icon: <IconBuilding size={20} className="text-primary" />,
            }))}
            onSelect={handleSelectUnterkunft}
            searchPlaceholder="Unterkunft suchen..."
            emptyIcon={<IconBuilding size={32} />}
            emptyText="Noch keine Unterkünfte vorhanden."
            createLabel="Neue Unterkunft anlegen"
            onCreateNew={() => setUnterkunftDialogOpen(true)}
            createDialog={
              <UnterkuenfteDialog
                open={unterkunftDialogOpen}
                onClose={() => setUnterkunftDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createUnterkuenfteEntry(fields);
                  await fetchAll();
                  setUnterkunftDialogOpen(false);
                }}
                enablePhotoScan={AI_PHOTO_SCAN['Unterkuenfte']}
                enablePhotoLocation={AI_PHOTO_LOCATION['Unterkuenfte']}
              />
            }
          />
        </div>
      )}

      {/* ── Step 3: Details & Kundendaten ── */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Zusatzausflüge & Reisedaten</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gib alle weiteren Details zur Buchung ein.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => goToStep(2)} className="shrink-0 gap-1">
              <IconArrowLeft size={14} />
              Zurück
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Form */}
            <div className="lg:col-span-2 space-y-5">
              {/* Kundendaten */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Kundendaten
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="vorname">Vorname *</Label>
                    <Input
                      id="vorname"
                      value={kundeVorname}
                      onChange={e => setKundeVorname(e.target.value)}
                      placeholder="z.B. Max"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nachname">Nachname *</Label>
                    <Input
                      id="nachname"
                      value={kundeNachname}
                      onChange={e => setKundeNachname(e.target.value)}
                      placeholder="z.B. Mustermann"
                    />
                  </div>
                </div>
              </div>

              {/* Reisedaten */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Reisedaten
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="abreise">Abreisedatum *</Label>
                    <Input
                      id="abreise"
                      type="date"
                      value={abreisedatum}
                      onChange={e => setAbreisedatum(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rueckreise">Rückreisedatum *</Label>
                    <Input
                      id="rueckreise"
                      type="date"
                      value={rueckreisedatum}
                      onChange={e => setRueckreisedatum(e.target.value)}
                    />
                  </div>
                </div>
                {reisedauerNaechte > 0 && (
                  <p className="text-sm text-primary font-medium">
                    Reisedauer: {reisedauerNaechte} Nacht{reisedauerNaechte !== 1 ? 'e' : ''}
                  </p>
                )}
              </div>

              {/* Teilnehmer */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Teilnehmer
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="erw">Anzahl Erwachsene *</Label>
                    <Input
                      id="erw"
                      type="number"
                      min={1}
                      max={99}
                      value={anzahlErwachsene}
                      onChange={e => setAnzahlErwachsene(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="kind">Anzahl Kinder</Label>
                    <Input
                      id="kind"
                      type="number"
                      min={0}
                      max={99}
                      value={anzahlKinder}
                      onChange={e => setAnzahlKinder(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                </div>
              </div>

              {/* Verpflegung */}
              <div className="rounded-2xl border bg-card p-5 space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Verpflegung
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {verpflegungOptions.map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setVerpflegung(opt.key)}
                      className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        verpflegung === opt.key
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:border-primary/40 hover:bg-accent'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Versicherung */}
              <div className="rounded-2xl border bg-card p-5">
                <button
                  type="button"
                  onClick={() => setReiseruecktrittsversicherung(v => !v)}
                  className="w-full flex items-center gap-3 text-left"
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      reiseruecktrittsversicherung
                        ? 'bg-primary border-primary'
                        : 'border-border'
                    }`}
                  >
                    {reiseruecktrittsversicherung && <IconCheck size={12} stroke={3} className="text-primary-foreground" />}
                  </div>
                  <div>
                    <span className="font-medium text-sm">Reiserücktrittsversicherung</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      3% des Paketpreises — schützt bei unvorhergesehenen Stornierungen
                    </p>
                  </div>
                </button>
              </div>

              {/* Ausflug */}
              <div className="rounded-2xl border bg-card p-5 space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Zusatzausflug (optional)
                </h3>
                <div className="space-y-2">
                  {/* Kein Ausflug */}
                  <button
                    type="button"
                    onClick={() => setSelectedAusflug(null)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                      selectedAusflug === null
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:bg-accent hover:border-primary/30'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedAusflug === null ? 'border-primary' : 'border-border'
                      }`}
                    >
                      {selectedAusflug === null && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className="text-sm font-medium">Kein Ausflug</span>
                  </button>

                  {/* Ausflüge Liste */}
                  {ausfluege.map(a => (
                    <button
                      key={a.record_id}
                      type="button"
                      onClick={() => setSelectedAusflug(a)}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                        selectedAusflug?.record_id === a.record_id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:bg-accent hover:border-primary/30'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          selectedAusflug?.record_id === a.record_id ? 'border-primary' : 'border-border'
                        }`}
                      >
                        {selectedAusflug?.record_id === a.record_id && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{a.fields.ausflug_name ?? '(kein Name)'}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(a.fields.preis_pro_person)}/Person
                          {a.fields.dauer_stunden != null && ` · ${a.fields.dauer_stunden} Std.`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Neuen Ausflug anlegen */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setAusflugDialogOpen(true)}
                >
                  <IconPlus size={14} />
                  Neuen Ausflug anlegen
                </Button>
                <AusfluegeDialog
                  open={ausflugDialogOpen}
                  onClose={() => setAusflugDialogOpen(false)}
                  onSubmit={async (fields) => {
                    await LivingAppsService.createAusfluegeEntry(fields);
                    await fetchAll();
                    setAusflugDialogOpen(false);
                  }}
                  enablePhotoScan={AI_PHOTO_SCAN['Ausfluege']}
                  enablePhotoLocation={AI_PHOTO_LOCATION['Ausfluege']}
                />
              </div>

              {step3Error && (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  <IconAlertCircle size={16} className="shrink-0" />
                  {step3Error}
                </div>
              )}

              <Button
                className="w-full gap-2"
                onClick={() => {
                  if (validateStep3()) goToStep(4);
                }}
              >
                Zur Preisübersicht
                <IconArrowRight size={16} />
              </Button>
            </div>

            {/* Right: Live price preview */}
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-5 space-y-3 sticky top-4">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Vorschau Preis
                </h3>
                <div className="divide-y divide-border">
                  <PriceRow label="Paket (Erw.)" value={price.paketPreisErw} />
                  {anzahlKinder > 0 && <PriceRow label="Paket (Kinder)" value={price.paketPreisKind} />}
                  <PriceRow label="Unterkunft" value={price.unterkunftskosten} />
                  {price.verpflegungskosten > 0 && <PriceRow label="Verpflegung" value={price.verpflegungskosten} />}
                  {price.kurtaxe > 0 && <PriceRow label="Kurtaxe" value={price.kurtaxe} />}
                  {price.ausfluege_summe > 0 && <PriceRow label="Ausflug" value={price.ausfluege_summe} />}
                  {price.versicherungskosten > 0 && <PriceRow label="Versicherung" value={price.versicherungskosten} />}
                  {price.fruehbucher_rabatt > 0 && (
                    <PriceRow label="Frühbucherrabatt" value={price.fruehbucher_rabatt} negative />
                  )}
                  <PriceRow label="MwSt. (19%)" value={price.mwst_betrag} />
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-base">Gesamt</span>
                    <span className="font-bold text-lg text-primary">{formatCurrency(price.brutto_gesamt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Anzahlung (20%): {formatCurrency(price.anzahlung)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Preisübersicht ── */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Preisübersicht & Zusammenfassung</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Überprüfe alle Details vor der Buchung.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => goToStep(3)} className="shrink-0 gap-1">
              <IconArrowLeft size={14} />
              Zurück
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Zusammenfassung */}
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-5 space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Deine Auswahl
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <IconPackage size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{selectedPaket?.fields.paket_name ?? '—'}</p>
                      <p className="text-muted-foreground">{selectedPaket?.fields.zielort ?? ''}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <IconBuilding size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{selectedUnterkunft?.fields.hotelname ?? '—'}</p>
                      {selectedUnterkunft?.fields.sterne != null && (
                        <StarDisplay count={selectedUnterkunft.fields.sterne} />
                      )}
                    </div>
                  </div>
                  {selectedAusflug && (
                    <div className="flex gap-2">
                      <IconMap2 size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">{selectedAusflug.fields.ausflug_name ?? '—'}</p>
                        <p className="text-muted-foreground">{formatCurrency(selectedAusflug.fields.preis_pro_person)}/Person</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border bg-card p-5 space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                  Reisedetails
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Kunde</p>
                    <p className="font-medium">{kundeVorname} {kundeNachname}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Reisedauer</p>
                    <p className="font-medium">{reisedauerNaechte} Nacht{reisedauerNaechte !== 1 ? 'e' : ''}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Abreise</p>
                    <p className="font-medium">{abreisedatum}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Rückreise</p>
                    <p className="font-medium">{rueckreisedatum}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Erwachsene</p>
                    <p className="font-medium">{anzahlErwachsene}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Kinder</p>
                    <p className="font-medium">{anzahlKinder}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Verpflegung</p>
                    <p className="font-medium">
                      {verpflegungOptions.find(o => o.key === verpflegung)?.label ?? verpflegung}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Versicherung</p>
                    <p className="font-medium">{reiseruecktrittsversicherung ? 'Ja' : 'Nein'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Preiskalkulation */}
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-5 space-y-1">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                  Preisaufschlüsselung
                </h3>
                <div className="divide-y divide-border">
                  <PriceRow label={`Paket Erwachsene (${anzahlErwachsene}×)`} value={price.paketPreisErw} />
                  {anzahlKinder > 0 && (
                    <PriceRow label={`Paket Kinder (${anzahlKinder}×)`} value={price.paketPreisKind} />
                  )}
                  <PriceRow label={`Unterkunft (${reisedauerNaechte} Nächte)`} value={price.unterkunftskosten} />
                  {price.verpflegungskosten > 0 && (
                    <PriceRow label="Verpflegung" value={price.verpflegungskosten} />
                  )}
                  {price.kurtaxe > 0 && (
                    <PriceRow label="Kurtaxe" value={price.kurtaxe} />
                  )}
                  {price.ausfluege_summe > 0 && (
                    <PriceRow label="Ausflug" value={price.ausfluege_summe} />
                  )}
                  {price.versicherungskosten > 0 && (
                    <PriceRow label="Reiserücktrittsversicherung" value={price.versicherungskosten} />
                  )}
                  {price.fruehbucher_rabatt > 0 && (
                    <PriceRow label="Frühbucherrabatt (5%)" value={price.fruehbucher_rabatt} negative />
                  )}
                  <div className="py-2">
                    <PriceRow label="Netto gesamt" value={price.netto_gesamt} highlight />
                  </div>
                  <PriceRow label="MwSt. (19%)" value={price.mwst_betrag} />
                  <div className="py-2">
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-bold text-base">Brutto gesamt</span>
                      <span className="font-bold text-xl text-primary">{formatCurrency(price.brutto_gesamt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <BudgetTracker
                budget={price.brutto_gesamt}
                booked={price.anzahlung}
                label="Anzahlung (20%)"
                showRemaining={true}
              />

              {price.fruehbucher_rabatt > 0 && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  <strong>Frühbucherrabatt!</strong> Du sparst {formatCurrency(price.fruehbucher_rabatt)} bei Buchung mehr als 60 Tage vor Abreise.
                </div>
              )}
            </div>
          </div>

          <Button
            className="w-full gap-2 mt-2"
            size="lg"
            onClick={() => {
              setSubmitError(null);
              goToStep(5);
              // Trigger creation immediately on entering step 5
            }}
          >
            Buchung anlegen
            <IconArrowRight size={16} />
          </Button>
        </div>
      )}

      {/* ── Step 5: Buchung anlegen ── */}
      {step === 5 && (
        <SubmitStep
          submitting={submitting}
          submitError={submitError}
          price={price}
          onConfirm={handleCreateBuchung}
          onBack={() => goToStep(4)}
        />
      )}

      {/* ── Step 6: Erfolg ── */}
      {step === 6 && (
        <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <IconCircleCheck size={48} className="text-green-600" stroke={1.5} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Buchung erfolgreich!</h2>
            <p className="text-muted-foreground mt-2">
              Buchung für{' '}
              <span className="font-semibold text-foreground">{createdName}</span>{' '}
              wurde erfolgreich angelegt.
            </p>
          </div>
          <div className="rounded-2xl border bg-card px-8 py-4 text-center">
            <p className="text-sm text-muted-foreground">Gesamtbetrag</p>
            <p className="text-3xl font-bold text-primary mt-1">{formatCurrency(createdBrutto)}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <Button variant="outline" className="flex-1 gap-2" onClick={resetWizard}>
              <IconRefresh size={16} />
              Neue Buchung
            </Button>
            <Button className="flex-1 gap-2" asChild>
              <a href="#/">
                <IconHome size={16} />
                Zur Übersicht
              </a>
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}

// Separate component to avoid hook ordering issues in step 5
function SubmitStep({
  submitting,
  submitError,
  price,
  onConfirm,
  onBack,
}: {
  submitting: boolean;
  submitError: string | null;
  price: PriceCalc;
  onConfirm: () => Promise<void>;
  onBack: () => void;
}) {
  // Auto-trigger creation once when this step first mounts
  const calledRef = useRef(false);

  useEffect(() => {
    if (!calledRef.current) {
      calledRef.current = true;
      void onConfirm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (submitting) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <IconLoader2 size={48} className="text-primary animate-spin" stroke={1.5} />
        <div className="text-center">
          <h3 className="font-semibold text-lg">Buchung wird angelegt...</h3>
          <p className="text-sm text-muted-foreground mt-1">Bitte einen Moment Geduld.</p>
        </div>
        <div className="rounded-2xl border bg-card px-6 py-3 text-sm text-muted-foreground">
          Gesamtbetrag: <span className="font-bold text-foreground">{formatCurrency(price.brutto_gesamt)}</span>
        </div>
      </div>
    );
  }

  if (submitError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <IconAlertCircle size={36} className="text-destructive" stroke={1.5} />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Fehler beim Anlegen</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">{submitError}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <IconArrowLeft size={16} />
            Zurück
          </Button>
          <Button onClick={() => { void onConfirm(); }} className="gap-2">
            <IconRefresh size={16} />
            Nochmal versuchen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <IconLoader2 size={48} className="text-primary animate-spin" stroke={1.5} />
      <p className="text-sm text-muted-foreground">Initialisiere Buchung...</p>
    </div>
  );
}
