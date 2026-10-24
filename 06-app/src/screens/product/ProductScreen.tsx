import { Check, ChevronLeft, Share } from 'lucide-react';
import { useRef, useState, type CSSProperties } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { catalogApi } from '../../api/catalog';
import { errorText } from '../../api/client';
import { ordersApi } from '../../api/orders';
import type { Offer, Product } from '../../domain/types';
import { rub } from '../../lib/format';
import { sized as photo } from '../../lib/img';
import { ani } from '../../lib/motion';
import { useApi } from '../../lib/useApi';
import { useDeskScroll } from '../../lib/useDeskScroll';
import { useNav } from '../../nav/useNav';
import { useRequireAuth } from '../../nav/useRequireAuth';
import { actions, useApp } from '../../store/app';
import { hasNativeBack, haptic } from '../../telegram/tma';
import { Empty, H, Note, Skel } from '../../ui/blocks';
import { Header } from '../../ui/Header';
import { productPath } from '../../domain/catalog';
import { filt0 } from '../../domain/filter';
import { ProductGrid } from '../catalog/CatalogScreen';
import type { BtnSpec } from '../../ui/Btn';
import { Screen } from '../../ui/Screen';
import { useSheet } from '../../ui/Sheet';
import { Tag, tagStyle } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';
import { sizeHelpSheet } from '../link/LinkScreen';

/** 7b–7f, 7b1/7b2, 7o–7q — карточка товара: галерея 4:5, цвет, размер, выбор конкретной вещи, «Под заказ». */
export function ProductScreen() {
  const { id = '' } = useParams();
  // ?c= — расцветка, с карточки которой пришли из каталога.
  const color = useSearchParams()[0].get('c') ?? '';
  const q = useApi(() => catalogApi.product(id), [id], 'product:' + id);

  if (q.error && !q.data) {
    return <Screen bare><div className="screen-body"><Note tone="err" title="Нет соединения" text="Проверьте интернет и повторите. Черновики и введённые данные не пропадут." act={{ label: 'Повторить', on: q.reload }} /></div></Screen>;
  }
  if (q.data === undefined) return <ProductSkeleton />;
  if (q.data === null) return <NotFoundScreen />;
  return <ProductView key={color} p={q.data} color={color} />;
}

type Sel = { color: number; size: string | null; offer: number | null; resetFrom: string | null };

function ProductView({ p, color }: { p: Product; color: string }) {
  const nav = useNav();
  const toast = useToast();
  const sheet = useSheet();
  const needAuth = useRequireAuth();
  const fav = useApp((s) => s.favs.includes(p.id));
  const cart = useApp((s) => s.cart);
  const sized = p.sizeGrid.length > 0;
  const [sel, setSel] = useState<Sel>({ color: Math.max(0, p.colors.findIndex((x) => x.id === color)), size: sized ? null : '', offer: null, resetFrom: null });
  const [gi, setGi] = useState(0);
  const gal = useDeskScroll<HTMLDivElement>({ paged: true });
  const heart = useRef<SVGSVGElement>(null);

  const c = p.colors[sel.color];
  const offersOf = (colorId: string, size: string | null) => (size == null ? [] : p.offers.filter((o) => o.color === colorId && o.size === size));
  const preOk = (colorId: string, size: string) => (p.preorder[colorId] ?? []).includes(size);
  const list = offersOf(c.id, sel.size);
  const resolved: Offer | null = list.length === 1 ? list[0] : sel.offer != null ? list[sel.offer] ?? null : null;
  const preOn = sel.size != null && sel.size !== '' && list.length === 0 && preOk(c.id, sel.size);
  const colorPrices = p.offers.filter((o) => o.color === c.id).map((o) => o.price);
  const inCartFull = !!resolved && cart.some((r) => r.offerId === resolved.id && !r.gone && r.qty >= r.max);

  const pickColor = (i: number) => {
    if (i === sel.color) return;
    const next = p.colors[i];
    const prev = sel.size;
    const keepList = prev != null ? offersOf(next.id, prev) : [];
    const keep = prev != null && keepList.length > 0 ? prev : sized ? null : '';
    gal.current?.scrollTo({ left: 0 });
    setGi(0);
    setSel({ color: i, size: keep, offer: keep != null && keepList.length === 1 ? 0 : null, resetFrom: prev && keep == null ? prev : null });
  };
  const pickSize = (size: string) => {
    const l = offersOf(c.id, size);
    if (!l.length && !preOk(c.id, size)) return;
    haptic.light();
    setSel({ ...sel, size, offer: l.length === 1 ? 0 : null, resetFrom: null });
  };

  const toggleFav = () => {
    ani(heart.current, [{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 280 });
    const on = actions.toggleFav(p.id);
    toast(on ? 'Добавлено в избранное' : 'Убрано из избранного');
  };

  const add = () => {
    if (!resolved) return;
    if (actions.addToCart(p, resolved)) { haptic.light(); toast('Добавлено в корзину'); }
  };

  const params = c.name + ' · размер ' + (sel.size ?? '');
  const openPreorder = () => {
    sheet.open({
      title: 'Заявка под заказ',
      body: (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, padding: 12, borderRadius: 16, background: 'var(--neu)' }}>
            <div role="img" aria-label={p.name} style={{ width: 52, height: 52, borderRadius: 12, flex: 'none', backgroundImage: `url(${photo(c.thumb, 240)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--f-name)', fontWeight: 600, lineHeight: 1.3 }}>{p.name}</div>
              <div style={{ marginTop: 4, fontSize: 'var(--f-small)' }}>{params}</div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 'var(--f-small)', fontWeight: 500, lineHeight: 1.45, color: 'var(--ink2)' }}>Цену и возможность заказа подтвердит продавец.</div>
        </>
      ),
      btns: [
        { label: 'Отправить заявку', kind: 'primary', stay: true, on: () => {
          ordersApi.createPreorder({ itemId: p.id, name: p.name, color: c.name, size: sel.size ?? '', thumb: c.thumb }).then(
            (pre) => {
              actions.addPreorder(pre);
              haptic.success();
              sheet.open({
                top: <div style={{ width: 44, height: 44, marginBottom: 12, borderRadius: 999, background: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={22} strokeWidth={2.6} color="#111111" aria-hidden /></div>,
                title: 'Заявка отправлена',
                body: (
                  <>
                    <div style={{ marginTop: 8, fontSize: 'var(--f-body)', lineHeight: 1.5, color: 'var(--ink2)' }}>Статус заявки появится в разделе «Мои заказы».</div>
                    <div style={{ marginTop: 10, fontSize: 'var(--f-small)' }}>{params}</div>
                  </>
                ),
                btns: [{ label: 'Понятно', kind: 'ghost' }],
              });
            },
            (e) => { haptic.error(); toast(errorText(e, 'Не получилось отправить заявку — попробуйте ещё раз'), 'error'); },
          );
        } },
        { label: 'Отмена', kind: 'ghost' },
      ],
    });
  };

  let btns: BtnSpec[];
  if (preOn) btns = [{ label: 'Под заказ', kind: 'primary', on: openPreorder }];
  else if (resolved) {
    btns = [
      inCartFull ? { label: 'В корзине', kind: 'limeSoft', on: () => nav.root('/cart') } : { label: 'В корзину', kind: 'limeSoft', on: add },
      { label: 'Заказать', kind: 'primary', on: () => needAuth('/checkout?offer=' + resolved.id) },
    ];
  } else btns = [{ label: sel.size == null ? 'Выберите размер' : 'Выберите вещь', kind: 'primary', dis: true }];

  const price = preOn ? 'Цена по запросу' : resolved ? rub(resolved.price) : colorPrices.length ? 'от ' + rub(Math.min(...colorPrices)) : 'Цена по запросу';
  const showOffers = list.length > 1;
  const roundBtn: CSSProperties = { position: 'absolute', top: 'calc(12px + var(--safe-top))', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 999, background: 'var(--lb-white-a92)', boxShadow: '0 8px 18px -10px var(--lb-ink-a65)', cursor: 'pointer', color: 'var(--lb-ink)' };

  return (
    <Screen bare bar={{ btns }}>
      <div style={{ position: 'relative', background: 'var(--neu)' }}>
        <div ref={gal} data-hs onScroll={(e) => {
          const el = e.currentTarget; const w = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth : 1;
          const i = Math.max(0, Math.round(el.scrollLeft / w)); if (i !== gi) setGi(i);
        }} style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory' }}>
          {c.photos.map((ph, i) => (
            <button key={ph} type="button" aria-label="Открыть фото на весь экран" onClick={() => nav.go(`/viewer/product/${p.id}?c=${c.id}&i=${i}`)}
              style={{ flex: '0 0 100%', minWidth: '100%', aspectRatio: '4 / 5', scrollSnapAlign: 'start', padding: 0, border: 0, background: 'none', cursor: 'zoom-in' }}>
              <img src={photo(ph, 960)} alt={`${p.name}, ${c.name}, фото ${i + 1}`} loading={i ? 'lazy' : 'eager'} decoding="async" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>
          ))}
        </div>
        {!hasNativeBack() && nav.depth > 0 && (
          <button type="button" aria-label={'Назад: ' + nav.backLabel} onClick={nav.back} className="pressable-xs" style={{ ...roundBtn, left: 12 }}>
            <ChevronLeft size={20} strokeWidth={2.4} aria-hidden />
          </button>
        )}
        <button type="button" aria-label={fav ? 'Убрать из избранного' : 'В избранное'} aria-pressed={fav} onClick={toggleFav} className="pressable-xs" style={{ ...roundBtn, right: 64 }}>
          <svg ref={heart} data-anim="heart" width="20" height="20" viewBox="0 0 24 24" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ fill: fav ? 'var(--lb-ink)' : 'none', stroke: 'var(--lb-ink)', transition: 'fill 160ms ease' }}>
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </button>
        <button type="button" aria-label="Поделиться" onClick={() => nav.go('/share/' + p.id)} className="pressable-xs" style={{ ...roundBtn, right: 12 }}>
          <Share size={19} strokeWidth={2.1} aria-hidden />
        </button>
        {c.photos.length > 1 && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'var(--lb-white-a80)', backdropFilter: 'blur(10px) saturate(160%)', WebkitBackdropFilter: 'blur(10px) saturate(160%)', boxShadow: '0 4px 12px -8px var(--lb-ink-a55)' }}>
              {c.photos.map((_, i) => <div key={i} style={{ width: i === gi ? 18 : 6, height: 6, borderRadius: 999, background: i === gi ? 'var(--lb-ink)' : 'var(--lb-ink-a28)', transition: 'width 200ms cubic-bezier(.23,1,.32,1)' }} />)}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '16px var(--px) 0' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--f-h1)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.15 }}>{p.name}</h1>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 'var(--f-big)', fontWeight: 700, letterSpacing: '-0.03em' }}>{price}</div>
          {resolved && !preOn && <Tag cond={resolved.cond} text={'Состояние: ' + resolved.cond} big />}
        </div>
        {preOn && <div style={{ marginTop: 6, fontSize: 'var(--f-small)', fontWeight: 500, lineHeight: 1.45 }}>Цену подтвердит продавец</div>}

        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 'var(--f-body)', fontWeight: 600 }}>Цвет:</span>
            <span style={{ fontSize: 'var(--f-body)', color: 'var(--ink2)' }}>{c.name}</span>
          </div>
          <div role="radiogroup" aria-label="Цвет" style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            {p.colors.map((cl, i) => {
              const on = i === sel.color;
              return (
                <button key={cl.id} type="button" role="radio" aria-checked={on} aria-label={'Цвет ' + cl.name} onClick={() => pickColor(i)} className="pressable-sm"
                  style={{ width: 56, height: 56, padding: 4, border: 0, borderRadius: 15, cursor: 'pointer', flex: 'none', background: on ? 'var(--lb-white)' : 'var(--lb-n-150)', boxShadow: on ? 'inset 0 0 0 2px var(--lb-ink)' : 'inset 0 0 0 1px var(--lb-ink-a08)', transition: 'box-shadow 180ms ease' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: 11, backgroundImage: `url(${photo(cl.thumb, 240)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                </button>
              );
            })}
          </div>
        </div>

        {sized && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 'var(--f-body)', fontWeight: 600 }}>Размер</span>
              <button type="button" onClick={() => (p.sizeChart ? nav.go('/chart/' + p.id) : sheet.open(sizeHelpSheet(`${p.name}, ${c.name}`)))} style={{ minHeight: 44, padding: 0, border: 0, background: 'none', fontSize: 'var(--f-small)', fontWeight: 600, color: 'var(--ink2)', textDecoration: 'underline', cursor: 'pointer' }}>Размерная сетка</button>
            </div>
            <div role="radiogroup" aria-label="Размер" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {p.sizeGrid.map((s) => {
                const has = offersOf(c.id, s).length > 0;
                const pre = !has && preOk(c.id, s);
                const on = sel.size === s;
                return (
                  <button key={s} type="button" role="radio" aria-checked={on} aria-disabled={has || pre ? 'false' : 'true'} aria-label={has ? s : pre ? s + ', под заказ' : s + ', нет в наличии'} onClick={() => pickSize(s)} className={has || pre ? 'pressable-sm' : undefined} style={sizeChip(on ? 'sel' : has ? 'on' : pre ? 'pre' : 'dis')}>{s}</button>
                );
              })}
            </div>
            {preOn && <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: 'var(--neu)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)', fontSize: 'var(--f-small)', fontWeight: 500, lineHeight: 1.45 }}>Нет в наличии · Можно под заказ</div>}
            {sel.resetFrom && <div role="status" style={{ marginTop: 12, padding: 12, borderRadius: 14, background: 'var(--lime-soft)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)', fontSize: 'var(--f-small)', lineHeight: 1.45 }}>Размер {sel.resetFrom} в цвете «{c.name}» недоступен — выберите заново.</div>}
          </div>
        )}

        {showOffers && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 'var(--f-body)', fontWeight: 600 }}>Доступные варианты</div>
            <div role="radiogroup" aria-label="Доступные варианты" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {list.map((o, i) => {
                const on = sel.offer === i;
                return (
                  <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => { haptic.select(); setSel({ ...sel, offer: i }); }} className="pressable"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 68, padding: 12, borderRadius: 16, border: 0, cursor: 'pointer', color: 'var(--lb-ink)', background: on ? 'var(--lb-lime-tint)' : 'var(--lb-n-50)', boxShadow: on ? 'inset 0 0 0 2px var(--lime)' : 'inset 0 0 0 1px var(--lb-ink-a10)', transition: 'box-shadow 180ms ease, background 180ms ease' }}>
                    <div style={{ width: 21, height: 21, borderRadius: 999, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? 'var(--lime)' : 'var(--lb-white)', boxShadow: on ? 'none' : 'inset 0 0 0 1.5px var(--lb-ink-a28)', transition: 'background 170ms ease' }}>
                      <Check size={12} strokeWidth={3.4} aria-hidden style={{ opacity: on ? 1 : 0, transform: on ? 'scale(1)' : 'scale(.7)', transition: 'opacity 150ms ease, transform 180ms cubic-bezier(.23,1,.32,1)' }} />
                    </div>
                    <div aria-hidden style={{ width: 44, height: 44, borderRadius: 10, flex: 'none', backgroundImage: `url(${photo(o.img, 240)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ display: 'flex' }}><span style={tagStyle(o.cond)}>{o.cond}</span></div>
                      <div style={{ marginTop: 4, fontSize: 'var(--f-small)', lineHeight: 1.35 }}>{o.note}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', flex: 'none' }}>{rub(o.price)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {p.description.trim() && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 'var(--f-body)', fontWeight: 600 }}>Описание</div>
            <div style={{ marginTop: 8, fontSize: 'var(--f-body)', lineHeight: 1.5, color: 'var(--ink2)', textWrap: 'pretty', whiteSpace: 'pre-line' }}>{p.description}</div>
          </div>
        )}
      </div>
    </Screen>
  );
}

function sizeChip(state: 'sel' | 'on' | 'dis' | 'pre'): CSSProperties {
  const sel = state === 'sel', dis = state === 'dis', pre = state === 'pre';
  return {
    minWidth: 48, height: 44, padding: '0 12px', border: 0, borderRadius: 13,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, fontWeight: 600,
    background: sel ? 'var(--lb-ink-2)' : dis || pre ? 'transparent' : 'var(--lb-n-150)',
    // Под заказ — размер можно выбрать: текст читаемый, отличие от наличия — контур вместо заливки.
    color: sel ? 'var(--lb-white)' : dis ? 'var(--lb-mute)' : pre ? 'var(--lb-ink-3)' : 'var(--lb-ink)',
    boxShadow: dis || pre ? 'inset 0 0 0 1px var(--lb-ink-a10)' : 'none',
    textDecoration: dis ? 'line-through' : 'none', cursor: dis ? 'default' : 'pointer',
    transition: 'background 170ms cubic-bezier(.23,1,.32,1), color 170ms ease, transform 140ms cubic-bezier(.23,1,.32,1)',
  };
}

function ProductSkeleton() {
  const bar = (w: string, h: number, mt: number): CSSProperties => ({ width: w, height: h, marginTop: mt, borderRadius: 8, background: 'var(--lb-n-150)' });
  return (
    <Screen bare>
      <div data-anim="pulse" role="status" aria-busy="true" aria-label="Загрузка" style={{ animation: 'lbPulse 1.4s ease-in-out infinite' }}>
        <div style={{ width: '100%', aspectRatio: '4 / 5', background: 'var(--lb-n-150)' }} />
        <div style={{ padding: '16px var(--px) 0' }}>
          <div style={bar('70%', 24, 0)} /><div style={bar('34%', 22, 14)} /><div style={bar('100%', 56, 24)} /><div style={bar('100%', 44, 24)} />
        </div>
      </div>
    </Screen>
  );
}

/** R — открыли ссылку на вещь, которую купили или сняли с продажи: путь в каталог и похожие. */
function NotFoundScreen() {
  const nav = useNav();
  const similar = useApi(() => catalogApi.list(filt0()), [], 'catalog:' + JSON.stringify(filt0()) + ':0');
  return (
    <Screen header={<Header title="Товар" />}>
      <Empty minH={300} title="Вещь больше не продаётся" text="Её купили или продавец снял её с продажи." btns={[{ label: 'В каталог', kind: 'primary', on: () => nav.root('/') }]} />
      <H text="Похожие" />
      {similar.data ? <ProductGrid items={similar.data.items.slice(1, 5)} onOpen={(it) => nav.go(productPath(it))} /> : <Skel />}
    </Screen>
  );
}
