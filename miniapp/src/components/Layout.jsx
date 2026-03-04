import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useEffect, useState } from 'react';

const HomeIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'var(--accent)' : 'none'} stroke={active ? 'var(--accent)' : 'var(--text-secondary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const SearchIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent)' : 'var(--text-secondary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const CartIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'var(--accent)' : 'none'} stroke={active ? 'var(--accent)' : 'var(--text-secondary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const OrderIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'var(--accent)' : 'none'} stroke={active ? 'var(--accent)' : 'var(--text-secondary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const ProfileIcon = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'var(--accent)' : 'none'} stroke={active ? 'var(--accent)' : 'var(--text-secondary)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { count } = useCart();
  const [prevCount, setPrevCount] = useState(count);
  const [shouldBounce, setShouldBounce] = useState(false);

  useEffect(() => {
    if (count > prevCount) {
      setShouldBounce(true);
      setTimeout(() => setShouldBounce(false), 300);
    }
    setPrevCount(count);
  }, [count, prevCount]);

  const navItems = [
    { path: '/', label: 'Home', Icon: HomeIcon },
    { path: '/search', label: 'Search', Icon: SearchIcon },
    { path: '/cart', label: 'Cart', Icon: CartIcon, badge: count },
    { path: '/orders', label: 'Orders', Icon: OrderIcon },
    { path: '/profile', label: 'Profile', Icon: ProfileIcon },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="page-container">
      <Outlet />

      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t border-border-light/50 z-50 shadow-nav"
        style={{ paddingBottom: 'var(--safe-bottom)', background: 'var(--nav-bg)' }}
      >
        <div className="flex justify-around items-center h-[60px]">
          {navItems.map(({ path, label, Icon, badge }) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex flex-col items-center justify-center flex-1 h-full relative transition-all min-w-[44px] group"
                aria-label={label}
              >
                <div className="relative">
                  <Icon active={active} />
                  {badge > 0 && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 bg-danger text-white text-[9px] min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center font-bold ${
                        shouldBounce ? 'badge-bounce' : ''
                      }`}
                    >
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] mt-1 font-medium transition-colors ${
                  active ? 'text-accent' : 'text-text-secondary'
                }`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
