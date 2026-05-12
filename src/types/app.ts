// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Reisepakete {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    paket_name?: string;
    zielort?: string;
    basispreis_erwachsener?: number;
    kinder_faktor?: number;
    mindestteilnehmer?: number;
  };
}

export interface Unterkuenfte {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    hotelname?: string;
    sterne?: number;
    preis_pro_nacht?: number;
    kurtaxe_pro_person_nacht?: number;
  };
}

export interface Ausfluege {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    ausflug_name?: string;
    preis_pro_person?: number;
    dauer_stunden?: number;
  };
}

export interface Reisebuchung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    kunde_vorname?: string;
    kunde_nachname?: string;
    buchungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    reisepaket?: string; // applookup -> URL zu 'Reisepakete' Record
    unterkunft?: string; // applookup -> URL zu 'Unterkuenfte' Record
    anzahl_erwachsene?: number;
    anzahl_kinder?: number;
    abreisedatum?: string; // Format: YYYY-MM-DD oder ISO String
    rueckreisedatum?: string; // Format: YYYY-MM-DD oder ISO String
    reisedauer_naechte?: number;
    verpflegung?: LookupValue;
    reiseruecktrittsversicherung?: boolean;
    zusatzausfluege?: string; // applookup -> URL zu 'Ausfluege' Record
    paketpreis_erwachsene?: number;
    paketpreis_kinder?: number;
    unterkunftskosten?: number;
    verpflegungskosten?: number;
    kurtaxe?: number;
    ausfluege_summe?: number;
    versicherungskosten?: number;
    fruehbucher_rabatt?: number;
    netto_gesamt?: number;
    mwst_betrag?: number;
    brutto_gesamt?: number;
    anzahlung?: number;
  };
}

export const APP_IDS = {
  REISEPAKETE: '6a031f4c161bbeec8df93d84',
  UNTERKUENFTE: '6a031f5397966ce6d6355a09',
  AUSFLUEGE: '6a031f53b08cd498187c08c5',
  REISEBUCHUNG: '6a031f549b19e27808c3cc43',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'reisebuchung': {
    verpflegung: [{ key: "ohne", label: "Ohne" }, { key: "fruehstueck", label: "Frühstück" }, { key: "halbpension", label: "Halbpension" }, { key: "vollpension", label: "Vollpension" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'reisepakete': {
    'paket_name': 'string/text',
    'zielort': 'string/text',
    'basispreis_erwachsener': 'number',
    'kinder_faktor': 'number',
    'mindestteilnehmer': 'number',
  },
  'unterkuenfte': {
    'hotelname': 'string/text',
    'sterne': 'number',
    'preis_pro_nacht': 'number',
    'kurtaxe_pro_person_nacht': 'number',
  },
  'ausfluege': {
    'ausflug_name': 'string/text',
    'preis_pro_person': 'number',
    'dauer_stunden': 'number',
  },
  'reisebuchung': {
    'kunde_vorname': 'string/text',
    'kunde_nachname': 'string/text',
    'buchungsdatum': 'date/date',
    'reisepaket': 'applookup/select',
    'unterkunft': 'applookup/select',
    'anzahl_erwachsene': 'number',
    'anzahl_kinder': 'number',
    'abreisedatum': 'date/date',
    'rueckreisedatum': 'date/date',
    'reisedauer_naechte': 'number',
    'verpflegung': 'lookup/radio',
    'reiseruecktrittsversicherung': 'bool',
    'zusatzausfluege': 'applookup/select',
    'paketpreis_erwachsene': 'number',
    'paketpreis_kinder': 'number',
    'unterkunftskosten': 'number',
    'verpflegungskosten': 'number',
    'kurtaxe': 'number',
    'ausfluege_summe': 'number',
    'versicherungskosten': 'number',
    'fruehbucher_rabatt': 'number',
    'netto_gesamt': 'number',
    'mwst_betrag': 'number',
    'brutto_gesamt': 'number',
    'anzahlung': 'number',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateReisepakete = StripLookup<Reisepakete['fields']>;
export type CreateUnterkuenfte = StripLookup<Unterkuenfte['fields']>;
export type CreateAusfluege = StripLookup<Ausfluege['fields']>;
export type CreateReisebuchung = StripLookup<Reisebuchung['fields']>;