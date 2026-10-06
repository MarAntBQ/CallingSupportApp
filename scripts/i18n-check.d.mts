export type KeyDiff = { missing: string[]; extra: string[] };

export type MessageProblem = KeyDiff & { locale: string };

export declare const SOURCE_LOCALE: string;

export declare const DEFAULT_MESSAGES_DIR: string;

export declare function flattenKeys(messages: unknown, prefix?: string): string[];

export declare function compareKeys(source: unknown, target: unknown): KeyDiff;

export declare function checkMessagesDir(
  dir?: string,
  sourceLocale?: string,
): { locales: string[]; problems: MessageProblem[] };

export declare function formatProblems(problems: MessageProblem[]): string;
