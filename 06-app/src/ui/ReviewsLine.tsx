import { ChevronRight, Star } from 'lucide-react';
import { reviewsApi } from '../api/afterSale';
import { useApi } from '../lib/useApi';

/** Рейтинг магазина с сервера: { total, score, count }. Пока данных нет или оценок ноль — null. */
export function useReviewsSummary() {
  const q = useApi(() => reviewsApi.list(), [], 'reviews');
  const r = q.data?.rating;
  return r && r.total > 0 ? { score: r.score, count: r.count } : null;
}

/** Строка «★ 4,8 · 12 оценок · Читать отзывы ›» на «Заказе по ссылке». Пока оценок нет — не показывается. */
export function ReviewsLine({ onOpen }: { onOpen: () => void }) {
  const s = useReviewsSummary();
  if (!s) return null;
  return (
    <button type="button" onClick={onOpen} className="pressable-sm" aria-label={`Отзывы покупателей: ${s.score}, ${s.count}`}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, padding: '0 2px', border: 0, background: 'none', cursor: 'pointer', color: 'var(--lb-ink)', fontSize: 13.5 }}>
      <Star size={16} strokeWidth={0} fill="#111111" aria-hidden />
      <b style={{ fontWeight: 700 }}>{s.score}</b>
      <span style={{ color: 'var(--lb-ink-3)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {s.count}</span>
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 600, flex: 'none' }}>
        Читать отзывы <ChevronRight size={16} strokeWidth={2.4} aria-hidden />
      </span>
    </button>
  );
}
