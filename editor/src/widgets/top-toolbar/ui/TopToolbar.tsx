'use client';

import Link from 'next/link';

export function TopToolbar() {
  return (
    <header className="top-toolbar" data-testid="top-toolbar">
      <div className="top-toolbar__links">
        <Link className="top-toolbar__link" href="/">
          Editor
        </Link>
        <Link className="top-toolbar__link" href="/library">
          Library
        </Link>
      </div>
    </header>
  );
}
