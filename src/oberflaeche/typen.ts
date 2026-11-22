// Datenformen der Oberfläche (dieselben Felder wie im lokalen JobPilot, ohne Serverlogik).
export type DocumentInfo = { kind: string; filename: string; contentType: string; isGeneral?: boolean; isShared?: boolean };

export type Compatibility = {
  score: number | null;
  basis: "description" | "limited" | "initiative" | "profile-missing";
  reasons: string[];
  warnings: string[];
};

export type TrackerItemView = {
  id: string;
  status: string;
  sentAt: string | null;
  revision: number;
  updatedAt: string;
  documents: DocumentInfo[];
  compatibility?: Compatibility;
  url?: string;
  website?: string;
  sourceUrls?: string[];
  sourceUrl?: string;
  sourceLabel?: string;
  email?: string;
  company?: string;
  role?: string;
  location?: string;
  sector?: string;
  region?: string;
  opportunityType?: string;
  historical?: boolean;
  transcript?: boolean;
  enrollment?: boolean;
  mailSubject?: string;
  mailBody?: string;
  [key: string]: unknown;
};

export type AntwortArt = "eingang" | "interview" | "absage" | "unterlagen" | "antwort";

export type AntwortEintrag = {
  id: string;
  messageId: string;
  applicationId: string | null;
  kandidaten: string[];
  art: AntwortArt;
  subject: string;
  from: string;
  receivedAt: string;
  beleg: string;
  grund: string;
  automatisch: boolean;
  ignoriert?: boolean;
  manuell?: boolean;
  nurKopfzeilen?: boolean;
};

export type AntwortStand = {
  version: 1;
  uidValidity: string;
  lastUid: number;
  mailbox: string;
  lastAttempt: string | null;
  lastSuccess: string | null;
  error: string | null;
  remaining: number;
  checked: number;
  antworten: AntwortEintrag[];
  phase?: string;
};
