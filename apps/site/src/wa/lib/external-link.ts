const SERVICE_PATHS = ['/blog', '/status', '/affiliates'] as const;

function isService(href: string): boolean {
  return SERVICE_PATHS.some((path) => href === path || href.startsWith(`${path}/`));
}

export function newTabProps(href: string | undefined): { target?: '_blank'; rel?: string } {
  return href !== undefined && (/^https?:\/\//.test(href) || isService(href))
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};
}
