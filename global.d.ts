// Typed next-intl keys: an unknown key in t('…') is a TypeScript error.
type Messages = typeof import('./messages/en.json');

// eslint-disable-next-line @typescript-eslint/no-empty-interface
declare interface IntlMessages extends Messages {}
