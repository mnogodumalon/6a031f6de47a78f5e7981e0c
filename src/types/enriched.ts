import type { Reisebuchung } from './app';

export type EnrichedReisebuchung = Reisebuchung & {
  reisepaketName: string;
  unterkunftName: string;
  zusatzausfluegeName: string;
};
