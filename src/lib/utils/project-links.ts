export function projectHref(projectId: string): string {
  return `/projects/detail/?projectId=${encodeURIComponent(projectId)}`;
}

export function projectScansHref(projectId: string): string {
  return `/scans/?projectId=${encodeURIComponent(projectId)}`;
}
