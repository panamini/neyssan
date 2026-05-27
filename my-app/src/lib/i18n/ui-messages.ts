import type { ProductionUiLocale } from "../locale-registry";

export const EN_UI_MESSAGES = {
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.close": "Close",
  "nav.today": "Today",
  "nav.jobs": "Jobs",
  "nav.cv": "CV",
  "nav.proposals": "Proposals",
  "nav.documents": "Documents",
  "nav.settings": "Settings",
  "settings.interfaceLanguage": "Interface language",
  "settings.defaultDocumentLanguage": "Default document language",
  "settings.documentLanguageAutoHelp":
    "Match the job/source language when available.",
} as const;

export type UiMessageKey = keyof typeof EN_UI_MESSAGES;
export type UiMessageDictionary = Record<UiMessageKey, string>;
export type UiMessageLocale = ProductionUiLocale;

const FR_UI_MESSAGES = {
  "common.save": "Enregistrer",
  "common.cancel": "Annuler",
  "common.delete": "Supprimer",
  "common.close": "Fermer",
  "nav.today": "Aujourd'hui",
  "nav.jobs": "Offres",
  "nav.cv": "CV",
  "nav.proposals": "Propositions",
  "nav.documents": "Documents",
  "nav.settings": "Parametres",
  "settings.interfaceLanguage": "Langue de l'interface",
  "settings.defaultDocumentLanguage": "Langue par defaut du document",
  "settings.documentLanguageAutoHelp":
    "Utiliser la langue de l'offre/source quand elle est disponible.",
} satisfies UiMessageDictionary;

const ES_UI_MESSAGES = {
  "common.save": "Guardar",
  "common.cancel": "Cancelar",
  "common.delete": "Eliminar",
  "common.close": "Cerrar",
  "nav.today": "Hoy",
  "nav.jobs": "Empleos",
  "nav.cv": "CV",
  "nav.proposals": "Propuestas",
  "nav.documents": "Documentos",
  "nav.settings": "Ajustes",
  "settings.interfaceLanguage": "Idioma de la interfaz",
  "settings.defaultDocumentLanguage": "Idioma predeterminado del documento",
  "settings.documentLanguageAutoHelp":
    "Coincidir con el idioma de la oferta/fuente cuando este disponible.",
} satisfies UiMessageDictionary;

export const UI_MESSAGES = {
  en: EN_UI_MESSAGES,
  fr: FR_UI_MESSAGES,
  es: ES_UI_MESSAGES,
} as const satisfies Record<UiMessageLocale, UiMessageDictionary>;

export const UI_MESSAGE_LOCALES = Object.keys(UI_MESSAGES) as UiMessageLocale[];
