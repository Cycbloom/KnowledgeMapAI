export const PLUGIN_PERMISSIONS = {
  "graph:read": "Read knowledge graphs",
  "graph:write": "Modify knowledge graphs",
  "ai:read": "Use AI queries",
  "ai:write": "Trigger AI generation",
  "study:read": "Read study data",
  "study:write": "Modify study progress",
  "scheduler:read": "Read task data",
  "scheduler:write": "Modify tasks",
  "storage:read": "Read local storage",
  "storage:write": "Write local storage",
  "network": "Access external network",
} as const;

export type PluginPermission = keyof typeof PLUGIN_PERMISSIONS;

export const VALID_PERMISSIONS = new Set<string>(Object.keys(PLUGIN_PERMISSIONS));

export function isValidPermission(permission: string): boolean {
  return VALID_PERMISSIONS.has(permission);
}

export function validatePermissions(permissions: string[]): { valid: boolean; invalid: string[] } {
  const invalid = permissions.filter(p => !isValidPermission(p));
  return { valid: invalid.length === 0, invalid };
}

export function getPermissionDescription(permission: string): string {
  return PLUGIN_PERMISSIONS[permission as PluginPermission] ?? "Unknown permission";
}
