export const MODULES = ['temple-trips', 'users', 'callings', 'permissions', 'self-reliance'] as const;

export type ModuleKey = (typeof MODULES)[number];

export const MODULE_ACTIONS = ['read', 'create', 'update', 'delete'] as const;

export type ModuleAction = (typeof MODULE_ACTIONS)[number];

export const GLOBAL_ADMIN_LEVEL = 100;

export const LEADER_LEVEL = 50;

export const MODULE_HOME: Record<ModuleKey, string> = {
  'temple-trips': '/admin/temple-trips',
  users: '/admin/users',
  callings: '/admin/organizations',
  permissions: '/admin/organizations',
  'self-reliance': '/admin/self-reliance',
};

export function moduleHome(modules: readonly ModuleKey[]) {
  const first = MODULES.find((module) => modules.includes(module));
  return first ? MODULE_HOME[first] : null;
}
