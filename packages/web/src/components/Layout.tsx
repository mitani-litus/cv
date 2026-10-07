import type { ReactNode } from 'react';
import { Link } from '../router';
import { SERVICE_NAME } from '../config';

export function Header() {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link className="app-brand" href="/">
          {SERVICE_NAME}
        </Link>
        <nav className="app-nav" aria-label="サイト内メニュー">
          <Link className="bb-link" href="/#how">
            使い方
          </Link>
          <Link className="bb-link" href="/#about">
            このサービスについて
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <div className="app-stack" style={{ gap: 4 }}>
          <span className="app-brand" style={{ fontSize: '1rem' }}>
            {SERVICE_NAME}
          </span>
          <span className="app-muted">MITライセンスで公開しているオープンソースソフトウェアです。</span>
        </div>
        <nav className="app-footer__links" aria-label="フッターメニュー">
          <Link className="bb-link" href="/#how">
            使い方
          </Link>
          <Link className="bb-link" href="/#about">
            データの取り扱い
          </Link>
          <Link className="bb-link" href="/import">
            PDFからCSVを作成
          </Link>
          <a className="bb-link" href="https://github.com/mitani-litus/cv" rel="noopener noreferrer">
            ソースコード（GitHub）
          </a>
        </nav>
      </div>
    </footer>
  );
}

export function Page({ children, white = false, footer = true }: { children: ReactNode; white?: boolean; footer?: boolean }) {
  return (
    <div className={white ? 'app app--white' : 'app'}>
      <a className="app-skip bb-link" href="#main">
        本文へ移動
      </a>
      <Header />
      <main id="main">{children}</main>
      {footer && <Footer />}
    </div>
  );
}
