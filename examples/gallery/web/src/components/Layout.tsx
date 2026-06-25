import { Link, NavLink, Outlet } from 'react-router-dom';

const LINKS = [
  { to: '/privacy', label: 'Privacy X-Ray' },
  { to: '/assistant', label: 'Assistant' },
  { to: '/dashboard', label: 'Dashboard' },
];

export function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-page/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-shell items-center justify-between px-5">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-lg font-semibold text-ink">kerkit</span>
            <span className="font-mono text-xs text-ink-faint">/ showcase</span>
          </Link>
          <nav className="flex items-center gap-1">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-black/5 hover:text-ink'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-shell flex-1 px-5 py-9">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto w-full max-w-shell px-5 py-6 text-xs text-ink-faint">
          100% synthetic data (the <span className="font-mono">@kerkit/core</span> demo persona).
          Not a medical device or a clinical record. Runs with no keys and no database — the
          Spanish content you see is the <span className="font-mono">@kerkit/pack-argentina</span> locale pack.
        </div>
      </footer>
    </div>
  );
}
