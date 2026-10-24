import { useState } from 'react';
import { reviewsApi } from '../../api/afterSale';
import { useApi } from '../../lib/useApi';
import type { Review } from '../../mocks/afterSale';
import { openExternal } from '../../telegram/tma';
import { Btn } from '../../ui/Btn';
import { Chips, Note, Skel } from '../../ui/blocks';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { sized } from '../../lib/img';

const STAR = 'M11.1 3.6c.37-.75 1.43-.75 1.8 0l2.06 4.18 4.61.67c.82.12 1.15 1.13.56 1.71l-3.34 3.25.79 4.59c.14.82-.72 1.44-1.45 1.06L12 16.9l-4.13 2.17c-.73.38-1.59-.24-1.45-1.06l.79-4.59-3.34-3.25c-.6-.58-.27-1.59.55-1.71l4.62-.67 2.06-4.18Z';
const StarRow = ({ n, size }: { n: number; size: number }) => (
  <div role="img" aria-label={`Оценка ${n} из 5`} style={{ display: 'flex', gap: size > 15 ? 2 : 1, flex: 'none' }}>
    {[1, 2, 3, 4, 5].map((k) => <svg key={k} width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d={STAR} fill={k <= n ? 'var(--lb-ink)' : 'var(--lb-n-200)'} /></svg>)}
  </div>
);
const card = { padding: 14, borderRadius: 18, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)' } as const;
const FILTERS = ['Все', 'Покупка подтверждена', 'С фото', '1–3 звезды', 'Яндекс Карты'];
const ocenok = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'оценка' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'оценки' : 'оценок'}`;

/** AC — отзывы о labeled: общий рейтинг из трёх источников и только опубликованные модератором отзывы (adm20). */
export function ReviewsScreen() {
  const q = useApi(() => reviewsApi.list(), [], 'reviews');
  const [f, setF] = useState(0);
  const pick = (r: Review) => [true, r.kind === 'app', !!r.pics?.length, r.stars <= 3, r.kind === 'ya'][f];
  const total = q.data?.rating.total ?? 0;
  const maxBar = Math.max(1, ...(q.data?.rating.bars.map((b) => b.c) ?? []));
  const filters = FILTERS.filter((_, i) => i < 4 || q.data?.items.some((r) => r.kind === 'ya'));
  const shown = q.data?.items.filter(pick) ?? [];
  return (
    <Screen header={<Header title="Отзывы о labeled" sub={!q.data ? undefined : total ? `${ocenok(total)}${q.data.rating.sources.length > 1 ? ' из ' + q.data.rating.sources.length + ' источников' : ''}` : 'Отзывы появятся после первых заказов'} />}>
      {!q.data ? <Skel n={2} /> : (
        <>
          <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1 }}>{q.data.rating.score}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                {total > 0 && <StarRow n={Math.round(parseFloat(q.data.rating.score.replace(',', '.')))} size={18} />}
                <div style={{ fontSize: 12, lineHeight: 1.35, color: 'var(--lb-ink-2)' }}>{q.data.rating.count}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {q.data.rating.bars.map((b) => (
                <div key={b.n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                  <span style={{ width: 10, fontWeight: 700 }}>{b.n}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--lb-n-100)', overflow: 'hidden' }}><div style={{ width: `${(b.c / maxBar) * 100}%`, height: '100%', borderRadius: 999, background: 'var(--lb-ink-2)' }} /></div>
                  <span style={{ width: 36, textAlign: 'right', color: 'var(--lb-ink-2)' }}>{String(b.c).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}</span>
                </div>
              ))}
            </div>
            <div>
              {q.data.rating.sources.map((s) => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0 0', marginTop: 12, borderTop: '1px solid var(--lb-ink-a08)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ marginTop: 2, fontSize: 11.5, lineHeight: 1.35, color: 'var(--lb-ink-2)' }}>{s.meta}</div>
                  </div>
                  <div style={{ flex: 'none', fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>{s.score}</div>
                  {'url' in s && s.url && <Btn kind="ghost" small inline onClick={() => openExternal(s.url!)}>Открыть</Btn>}
                </div>
              ))}
            </div>
          </div>
          {q.data.items.length > 0 && <Chips label="Фильтр отзывов" rows={filters.map((x, i) => ({ label: x, on_: f === i, act: () => setF(i) }))} />}
          {q.data.items.length === 0 && <Note tone="info" title="Отзывов пока нет" text="Оставить отзыв можно после получения заказа — он появится здесь после проверки." />}
          {shown.map((r) => (
            <article key={r.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div aria-hidden style={{ width: 34, height: 34, flex: 'none', borderRadius: 999, background: 'var(--lb-n-150)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{r.name.split(' ').map((w) => w.charAt(0)).join('').slice(0, 2)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--lb-ink-2)' }}>{r.date}</div>
                </div>
                <StarRow n={r.stars} size={14} />
              </div>
              <div><span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: r.kind === 'app' ? 'var(--lb-lime-soft)' : 'var(--lb-n-150)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a10)' }}>{r.badge}</span></div>
              <div style={{ fontSize: 13, lineHeight: 1.45, textWrap: 'pretty' }}>{r.text}</div>
              {r.pics && r.pics.length > 0 && <div style={{ display: 'flex', gap: 6 }}>{r.pics.map((p) => <div key={p} role="img" aria-label="Фото из отзыва" style={{ width: 64, height: 64, flex: 'none', borderRadius: 12, backgroundImage: `url(${sized(p, 240)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />)}</div>}
              {r.reply && (
                <div style={{ padding: '10px 12px', borderRadius: 13, background: 'var(--lb-n-50)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a06)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700 }}>Ответ labeled · {r.replyDate}</div>
                  <div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.45, textWrap: 'pretty' }}>{r.reply}</div>
                </div>
              )}
              {r.kind !== 'app' && r.url && <button type="button" onClick={() => openExternal(r.url!)} style={{ alignSelf: 'flex-start', minHeight: 28, border: 0, background: 'transparent', padding: 0, fontSize: 12, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>{r.kind === 'ya' ? 'Открыть оригинал на Яндекс Картах' : 'Открыть оригинал в 2ГИС'}</button>}
            </article>
          ))}
          <Note tone="info" title="Почему этим отзывам можно верить" text="В приложении отзыв можно оставить только после получения заказа, и у него есть отметка с типом заказа и сроком доставки. Отзывы с Яндекс Карт и 2ГИС подтягиваются все подряд, без отбора, со ссылкой на оригинал. Низкие оценки не скрываются, ответы продавца публичные." />
        </>
      )}
    </Screen>
  );
}
