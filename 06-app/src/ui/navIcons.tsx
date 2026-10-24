// Силуэты нижней навигации согласованы с клиентом (03-design/references/reference-bottom-nav.png).
// Подписи под иконками добавлены 2026-10-10 (BottomNav.tsx, вариант А) — силуэты при этом не менялись.
// Не заменять на lucide: третья иконка рисует рёбра коробки цветом подложки (--nav-behind).

export const IconCatalog = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="3" y="3" width="8.3" height="8.3" rx="2.8" /><rect x="12.7" y="3" width="8.3" height="8.3" rx="2.8" />
    <rect x="3" y="12.7" width="8.3" height="8.3" rx="2.8" /><rect x="12.7" y="12.7" width="8.3" height="8.3" rx="2.8" />
  </svg>
);

export const IconCart = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M6.45 7.2h13.9a1.2 1.2 0 0 1 1.18 1.43l-1.24 6.3a1.95 1.95 0 0 1-1.92 1.57H9.1a1.95 1.95 0 0 1-1.91-1.54L6.45 7.2Z" />
    <path d="M2.5 3.4h1.9a1.6 1.6 0 0 1 1.57 1.29l.36 1.79" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="10" cy="19.7" r="1.8" /><circle cx="17.7" cy="19.7" r="1.8" />
  </svg>
);

export const IconLinkOrder = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
    <path d="M12 2.2 21.4 7v10L12 21.8 2.6 17V7Z" fill="currentColor" />
    <path d="M2.6 7 12 11.9 21.4 7M12 11.9v9.9" stroke="var(--nav-behind)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M7.3 4.6 16.7 9.4" stroke="var(--nav-behind)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
  </svg>
);

export const IconProfile = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="12" cy="7.3" r="4.4" />
    <path d="M12 13.2c4.5 0 7.8 2.45 7.8 5.7 0 1.07-.86 1.93-1.93 1.93H6.13c-1.07 0-1.93-.86-1.93-1.93 0-3.25 3.3-5.7 7.8-5.7Z" />
  </svg>
);
