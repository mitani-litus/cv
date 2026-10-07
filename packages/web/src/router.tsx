import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

export type Route = '/' | '/form' | '/import';

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

function currentRoute(): Route {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return path === '/form' || path === '/import' ? path : '/';
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, currentRoute, () => '/');
}

/** 画面を切り替える。URLには個人情報を含めない（パスだけを使う） */
export function navigate(to: string): void {
  const [path, hash] = to.split('#');
  if ((path || '/') !== window.location.pathname) {
    window.history.pushState(null, '', to);
    listeners.forEach((l) => l());
  } else if (hash !== undefined) {
    window.history.replaceState(null, '', to);
  }
  if (hash) {
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
  } else {
    window.scrollTo(0, 0);
  }
}

/** サイト内リンク。クリック時はページを再読み込みせずに切り替える */
export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handle} {...rest} />;
}
