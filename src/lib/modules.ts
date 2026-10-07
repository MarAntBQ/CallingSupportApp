export const MODULES = ['organizations', 'temple-trips', 'camp', 'english-connect'] as const;

export type ModuleKey = (typeof MODULES)[number];

export const GLOBAL_ADMIN_LEVEL = 100;
