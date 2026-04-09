import { isNavSection, NavLink, NavSection } from '../types';

export interface BreadcrumbItem {
  title: string;
  link?: NavLink;
}

export function findBreadcrumb(sections: NavSection[], currentUid: string): BreadcrumbItem[] | null {
  for (const section of sections) {
    for (const item of section.items) {
      if (!isNavSection(item)) {
        if (item.type === 'dashboard' && item.uid && item.uid === currentUid) {
          return [{ title: section.title }, { title: item.title, link: item }];
        }
      } else {
        for (const sub of item.items) {
          if (!isNavSection(sub) && sub.type === 'dashboard' && sub.uid === currentUid) {
            return [
              { title: section.title },
              { title: item.title },
              { title: sub.title, link: sub },
            ];
          }
        }
      }
    }
  }
  return null;
}
