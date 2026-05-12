import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichReisebuchung } from '@/lib/enrich';
import type { EnrichedReisebuchung } from '@/types/enriched';
import type { Reisepakete, Unterkuenfte, Ausfluege, Reisebuchung } from '@/types/app';
// @ts-ignore — available imports for dashboard implementation
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
// @ts-ignore
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
// @ts-ignore
import { formatDate, formatCurrency } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { IconAlertCircle, IconTool, IconRefresh, IconCheck, IconPlus, IconPencil, IconTrash, IconSearch, IconUsers, IconMapPin, IconCalendar, IconStar, IconShield, IconCurrencyEuro, IconBriefcase, IconUmbrella, IconChevronRight, IconEye } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ReisebuchungDialog } from '@/components/dialogs/ReisebuchungDialog';
import { AI_PHOTO_SCAN } from '@/config/ai-features';

const APPGROUP_ID = '6a031f6de47a78f5e7981e0c';
const REPAIR_ENDPOINT = '/claude/build/repair';

export default function DashboardOverview() {
  const {
    reisepakete, unterkuenfte, ausfluege, reisebuchung,
    reisepaketeMap, unterkuenfteMap, ausfluegeMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedReisebuchung = enrichReisebuchung(reisebuchung, { reisepaketeMap, unterkuenfteMap, ausfluegeMap });

  // --- State (ALL hooks before early returns!) ---
  const [search, setSearch] = useState('');
  const [selectedBuchung, setSelectedBuchung] = useState<EnrichedReisebuchung | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBuchung, setEditBuchung] = useState<EnrichedReisebuchung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedReisebuchung | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return enrichedReisebuchung;
    const q = search.toLowerCase();
    return enrichedReisebuchung.filter(b =>
      `${b.fields.kunde_vorname ?? ''} ${b.fields.kunde_nachname ?? ''}`.toLowerCase().includes(q) ||
      (b.reisepaketName ?? '').toLowerCase().includes(q) ||
      (b.unterkunftName ?? '').toLowerCase().includes(q) ||
      (b.fields.abreisedatum ?? '').includes(q)
    );
  }, [enrichedReisebuchung, search]);

  const stats = useMemo(() => {
    const totalUmsatz = reisebuchung.reduce((s, b) => s + (b.fields.brutto_gesamt ?? 0), 0);
    const upcoming = reisebuchung.filter(b => {
      if (!b.fields.abreisedatum) return false;
      return b.fields.abreisedatum >= new Date().toISOString().slice(0, 10);
    }).length;
    return { totalUmsatz, upcoming };
  }, [reisebuchung]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const handleCreate = async (fields: Reisebuchung['fields']) => {
    await LivingAppsService.createReisebuchungEntry(fields);
    fetchAll();
  };

  const handleEdit = async (fields: Reisebuchung['fields']) => {
    if (!editBuchung) return;
    await LivingAppsService.updateReisebuchungEntry(editBuchung.record_id, fields);
    if (selectedBuchung?.record_id === editBuchung.record_id) {
      setSelectedBuchung(null);
    }
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await LivingAppsService.deleteReisebuchungEntry(deleteTarget.record_id);
    if (selectedBuchung?.record_id === deleteTarget.record_id) setSelectedBuchung(null);
    setDeleteTarget(null);
    fetchAll();
  };

  const openCreate = () => {
    setEditBuchung(null);
    setDialogOpen(true);
  };

  const openEdit = (b: EnrichedReisebuchung) => {
    setEditBuchung(b);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Workflow Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href="#/intents/neue-reisebuchung"
          className="flex items-center gap-4 bg-card border border-border border-l-4 border-l-primary rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow no-underline"
        >
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">Neue Reisebuchung anlegen</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">Schritt-für-Schritt: Paket, Unterkunft, Ausflüge wählen & Preiskalkulation</p>
          </div>
          <IconChevronRight size={18} className="text-muted-foreground shrink-0" />
        </a>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Buchungen gesamt"
          value={String(reisebuchung.length)}
          description="alle Reisebuchungen"
          icon={<IconBriefcase size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Bevorstehende Reisen"
          value={String(stats.upcoming)}
          description="ab heute"
          icon={<IconCalendar size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Reisepakete"
          value={String(reisepakete.length)}
          description="verfügbare Pakete"
          icon={<IconMapPin size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Gesamtumsatz"
          value={stats.totalUmsatz > 0 ? formatCurrency(stats.totalUmsatz) : '—'}
          description="Brutto gesamt"
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Main Layout: List + Detail */}
      <div className="flex flex-col lg:flex-row gap-4 min-h-0">
        {/* Buchungsliste */}
        <div className="flex flex-col gap-3 w-full lg:w-[380px] shrink-0">
          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <IconSearch size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
              <Input
                className="pl-8 h-9 text-sm"
                placeholder="Kunde, Paket suchen…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={openCreate} className="shrink-0">
              <IconPlus size={15} className="mr-1 shrink-0" />
              <span className="hidden sm:inline">Neue Buchung</span>
              <span className="sm:hidden">Neu</span>
            </Button>
          </div>

          {/* Liste */}
          <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                <IconBriefcase size={40} className="text-muted-foreground" stroke={1.5} />
                <p className="text-sm text-muted-foreground">Keine Buchungen gefunden</p>
                <Button size="sm" variant="outline" onClick={openCreate}>
                  <IconPlus size={14} className="mr-1" />Erste Buchung anlegen
                </Button>
              </div>
            )}
            {filtered.map(b => {
              const isSelected = selectedBuchung?.record_id === b.record_id;
              const kundenname = `${b.fields.kunde_vorname ?? ''} ${b.fields.kunde_nachname ?? ''}`.trim() || '—';
              const abreise = formatDate(b.fields.abreisedatum);
              const isUpcoming = b.fields.abreisedatum && b.fields.abreisedatum >= new Date().toISOString().slice(0, 10);
              return (
                <div
                  key={b.record_id}
                  onClick={() => setSelectedBuchung(isSelected ? null : b)}
                  className={`
                    cursor-pointer rounded-xl border p-3 transition-all
                    ${isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30'}
                  `}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-sm truncate">{kundenname}</span>
                        {b.fields.reiseruecktrittsversicherung && (
                          <IconShield size={13} className="text-green-500 shrink-0" />
                        )}
                        {isUpcoming && (
                          <Badge variant="outline" className="text-xs py-0 px-1.5 text-primary border-primary/30">Bevorstehend</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {b.reisepaketName || '—'} · {b.unterkunftName || '—'}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {b.fields.abreisedatum && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <IconCalendar size={11} className="shrink-0" />
                            {abreise}
                          </span>
                        )}
                        {(b.fields.anzahl_erwachsene || b.fields.anzahl_kinder) && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <IconUsers size={11} className="shrink-0" />
                            {[
                              b.fields.anzahl_erwachsene ? `${b.fields.anzahl_erwachsene} Erw.` : null,
                              b.fields.anzahl_kinder ? `${b.fields.anzahl_kinder} Kind.` : null,
                            ].filter(Boolean).join(', ')}
                          </span>
                        )}
                        {b.fields.brutto_gesamt != null && (
                          <span className="text-xs font-semibold text-foreground ml-auto">{formatCurrency(b.fields.brutto_gesamt)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(b); }}
                        className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                        title="Bearbeiten"
                      >
                        <IconPencil size={14} className="text-muted-foreground" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteTarget(b); }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                        title="Löschen"
                      >
                        <IconTrash size={14} className="text-muted-foreground hover:text-destructive" />
                      </button>
                      <IconChevronRight size={14} className={`text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 min-w-0">
          {selectedBuchung ? (
            <BuchungDetail
              buchung={selectedBuchung}
              reisepakete={reisepakete}
              unterkuenfte={unterkuenfte}
              ausfluege={ausfluege}
              onEdit={() => openEdit(selectedBuchung)}
              onDelete={() => setDeleteTarget(selectedBuchung)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] rounded-2xl border border-dashed border-border bg-muted/20 gap-3 text-center px-4">
              <IconEye size={40} className="text-muted-foreground" stroke={1.5} />
              <p className="text-sm text-muted-foreground">Buchung auswählen, um Details anzuzeigen</p>
              <Button size="sm" variant="outline" onClick={openCreate}>
                <IconPlus size={14} className="mr-1" />Neue Buchung anlegen
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Unterkünfte & Ausflüge Übersicht */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AngeboteKarte
          title="Verfügbare Reisepakete"
          icon={<IconBriefcase size={16} className="text-primary" />}
          items={reisepakete.map(p => ({
            id: p.record_id,
            name: p.fields.paket_name ?? '—',
            sub: p.fields.zielort ?? '',
            badge: p.fields.basispreis_erwachsener != null ? formatCurrency(p.fields.basispreis_erwachsener) : undefined,
            badgeVariant: 'secondary' as const,
          }))}
        />
        <AngeboteKarte
          title="Verfügbare Unterkünfte"
          icon={<IconUmbrella size={16} className="text-primary" />}
          items={unterkuenfte.map(u => ({
            id: u.record_id,
            name: u.fields.hotelname ?? '—',
            sub: u.fields.sterne ? `${'★'.repeat(Math.round(u.fields.sterne))} Sterne` : '',
            badge: u.fields.preis_pro_nacht != null ? `${formatCurrency(u.fields.preis_pro_nacht)}/Nacht` : undefined,
            badgeVariant: 'outline' as const,
          }))}
        />
      </div>

      {/* Dialogs */}
      <ReisebuchungDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditBuchung(null); }}
        onSubmit={editBuchung ? handleEdit : handleCreate}
        defaultValues={editBuchung?.fields}
        reisepaketeList={reisepakete}
        unterkuenfteList={unterkuenfte}
        ausfluegeList={ausfluege}
        enablePhotoScan={AI_PHOTO_SCAN['Reisebuchung']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Buchung löschen"
        description={`Buchung von ${deleteTarget?.fields.kunde_vorname ?? ''} ${deleteTarget?.fields.kunde_nachname ?? ''} wirklich löschen?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// --- Buchung Detail ---
function BuchungDetail({
  buchung,
  reisepakete,
  unterkuenfte,
  ausfluege,
  onEdit,
  onDelete,
}: {
  buchung: EnrichedReisebuchung;
  reisepakete: Reisepakete[];
  unterkuenfte: Unterkuenfte[];
  ausfluege: Ausfluege[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const paketId = extractRecordId(buchung.fields.reisepaket);
  const unterkunftId = extractRecordId(buchung.fields.unterkunft);
  const ausflugId = extractRecordId(buchung.fields.zusatzausfluege);

  const paket = paketId ? reisepakete.find(p => p.record_id === paketId) : null;
  const unterkunft = unterkunftId ? unterkuenfte.find(u => u.record_id === unterkunftId) : null;
  const ausflug = ausflugId ? ausfluege.find(a => a.record_id === ausflugId) : null;

  const kundenname = `${buchung.fields.kunde_vorname ?? ''} ${buchung.fields.kunde_nachname ?? ''}`.trim() || '—';

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="bg-primary/5 border-b border-border px-5 py-4 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-bold text-lg truncate">{kundenname}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Buchungsdatum: {formatDate(buchung.fields.buchungsdatum)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <IconPencil size={14} className="mr-1" />Bearbeiten
          </Button>
          <Button size="sm" variant="outline" onClick={onDelete} className="text-destructive border-destructive/30 hover:bg-destructive/10">
            <IconTrash size={14} className="mr-1" />Löschen
          </Button>
        </div>
      </div>

      <div className="p-5 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        {/* Reisedaten */}
        <Section title="Reisedaten" icon={<IconCalendar size={15} className="text-primary" />}>
          <Row label="Abreise" value={formatDate(buchung.fields.abreisedatum)} />
          <Row label="Rückreise" value={formatDate(buchung.fields.rueckreisedatum)} />
          <Row label="Reisedauer" value={buchung.fields.reisedauer_naechte != null ? `${buchung.fields.reisedauer_naechte} Nächte` : '—'} />
          <Row label="Reisepaket" value={buchung.reisepaketName || '—'} />
          {paket && (
            <Row label="Zielort" value={paket.fields.zielort ?? '—'} />
          )}
        </Section>

        {/* Teilnehmer */}
        <Section title="Teilnehmer" icon={<IconUsers size={15} className="text-primary" />}>
          <Row label="Erwachsene" value={buchung.fields.anzahl_erwachsene != null ? String(buchung.fields.anzahl_erwachsene) : '—'} />
          <Row label="Kinder" value={buchung.fields.anzahl_kinder != null ? String(buchung.fields.anzahl_kinder) : '—'} />
          <Row label="Verpflegung" value={buchung.fields.verpflegung?.label ?? '—'} />
        </Section>

        {/* Unterkunft */}
        {unterkunft && (
          <Section title="Unterkunft" icon={<IconStar size={15} className="text-primary" />}>
            <Row label="Hotel" value={unterkunft.fields.hotelname ?? '—'} />
            <Row label="Sterne" value={unterkunft.fields.sterne != null ? `${unterkunft.fields.sterne} ★` : '—'} />
            <Row label="Preis/Nacht" value={unterkunft.fields.preis_pro_nacht != null ? formatCurrency(unterkunft.fields.preis_pro_nacht) : '—'} />
            <Row label="Kurtaxe/P./Nacht" value={unterkunft.fields.kurtaxe_pro_person_nacht != null ? formatCurrency(unterkunft.fields.kurtaxe_pro_person_nacht) : '—'} />
          </Section>
        )}

        {/* Zusatzausflug */}
        {ausflug && (
          <Section title="Zusatzausflug" icon={<IconMapPin size={15} className="text-primary" />}>
            <Row label="Ausflug" value={ausflug.fields.ausflug_name ?? '—'} />
            <Row label="Dauer" value={ausflug.fields.dauer_stunden != null ? `${ausflug.fields.dauer_stunden} Std.` : '—'} />
            <Row label="Preis/Person" value={ausflug.fields.preis_pro_person != null ? formatCurrency(ausflug.fields.preis_pro_person) : '—'} />
          </Section>
        )}

        {/* Kosten */}
        <Section title="Kostenübersicht" icon={<IconCurrencyEuro size={15} className="text-primary" />}>
          <Row label="Paketpreis Erw." value={buchung.fields.paketpreis_erwachsene != null ? formatCurrency(buchung.fields.paketpreis_erwachsene) : '—'} />
          <Row label="Paketpreis Kind." value={buchung.fields.paketpreis_kinder != null ? formatCurrency(buchung.fields.paketpreis_kinder) : '—'} />
          <Row label="Unterkunftskosten" value={buchung.fields.unterkunftskosten != null ? formatCurrency(buchung.fields.unterkunftskosten) : '—'} />
          <Row label="Verpflegungskosten" value={buchung.fields.verpflegungskosten != null ? formatCurrency(buchung.fields.verpflegungskosten) : '—'} />
          <Row label="Kurtaxe" value={buchung.fields.kurtaxe != null ? formatCurrency(buchung.fields.kurtaxe) : '—'} />
          <Row label="Ausflüge Summe" value={buchung.fields.ausfluege_summe != null ? formatCurrency(buchung.fields.ausfluege_summe) : '—'} />
          {buchung.fields.reiseruecktrittsversicherung && (
            <Row label="Versicherung" value={buchung.fields.versicherungskosten != null ? formatCurrency(buchung.fields.versicherungskosten) : 'inkl.'} />
          )}
          {buchung.fields.fruehbucher_rabatt != null && buchung.fields.fruehbucher_rabatt > 0 && (
            <Row label="Frühbucher-Rabatt" value={`– ${formatCurrency(buchung.fields.fruehbucher_rabatt)}`} valueClass="text-green-600" />
          )}
          <div className="border-t border-border pt-2 mt-2 space-y-1">
            <Row label="Netto gesamt" value={buchung.fields.netto_gesamt != null ? formatCurrency(buchung.fields.netto_gesamt) : '—'} />
            <Row label="MwSt." value={buchung.fields.mwst_betrag != null ? formatCurrency(buchung.fields.mwst_betrag) : '—'} />
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold">Brutto gesamt</span>
              <span className="text-sm font-bold text-primary">{buchung.fields.brutto_gesamt != null ? formatCurrency(buchung.fields.brutto_gesamt) : '—'}</span>
            </div>
            <Row label="Anzahlung (20%)" value={buchung.fields.anzahlung != null ? formatCurrency(buchung.fields.anzahlung) : '—'} />
          </div>
        </Section>

        {/* Extras */}
        <div className="flex gap-3 flex-wrap">
          {buchung.fields.reiseruecktrittsversicherung && (
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <IconShield size={15} className="shrink-0" />
              <span>Reiserücktrittsversicherung</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm text-right truncate ${valueClass ?? 'text-foreground'}`}>{value}</span>
    </div>
  );
}

// --- Angebote Karte ---
function AngeboteKarte({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: { id: string; name: string; sub: string; badge?: string; badgeVariant: 'secondary' | 'outline' }[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        {icon}
        <span className="font-semibold text-sm">{title}</span>
        <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>
      </div>
      <div className="divide-y divide-border max-h-60 overflow-y-auto">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Keine Einträge</p>
        )}
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-accent/30 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.name}</p>
              {item.sub && <p className="text-xs text-muted-foreground truncate">{item.sub}</p>}
            </div>
            {item.badge && (
              <Badge variant={item.badgeVariant} className="text-xs shrink-0">{item.badge}</Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Skeleton & Error (pre-generated below) ---
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
