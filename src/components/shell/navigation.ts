export interface NavigationItem {
  readonly href: string;
  readonly label: string;
  readonly description: string;
}

export const primaryNavigation = [
  {
    href: "/",
    label: "Dashboard",
    description: "学习控制台",
  },
  {
    href: "/roadmap/",
    label: "Roadmap",
    description: "学习路线",
  },
  {
    href: "/knowledge/",
    label: "Knowledge",
    description: "知识库",
  },
  {
    href: "/projects/",
    label: "Projects",
    description: "实践项目",
  },
  {
    href: "/study-log/",
    label: "Study Log",
    description: "学习记录",
  },
] as const satisfies readonly NavigationItem[];

export const auxiliaryNavigation = [
  {
    href: "/search/",
    label: "Search",
    description: "全局搜索",
  },
  {
    href: "/resources/",
    label: "Resources",
    description: "精选学习资源",
  },
  {
    href: "/settings/data/",
    label: "Settings / Data",
    description: "设置与本地数据",
  },
] as const satisfies readonly NavigationItem[];

export const searchNavigationItem = auxiliaryNavigation[0];
export const resourcesNavigationItem = auxiliaryNavigation[1];
export const settingsNavigationItem = auxiliaryNavigation[2];

function normalizePathname(pathname: string): string {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "") || "/";
}

export function isNavigationItemActive(
  pathname: string,
  item: NavigationItem,
): boolean {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedHref = normalizePathname(item.href);

  if (normalizedHref === "/") {
    return normalizedPathname === "/";
  }

  return (
    normalizedPathname === normalizedHref ||
    normalizedPathname.startsWith(`${normalizedHref}/`)
  );
}

export function resolveCurrentNavigationItem(
  pathname: string,
): NavigationItem | undefined {
  return [...primaryNavigation, ...auxiliaryNavigation].find((item) =>
    isNavigationItemActive(pathname, item),
  );
}
