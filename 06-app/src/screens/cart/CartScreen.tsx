import { Plus, Trash2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { filt0 } from '../../domain/filter';
import { plural, rub } from '../../lib/format';
import { ITEMS } from '../../mocks/catalog';
import { useNav } from '../../nav/useNav';
import { useRequireAuth } from '../../nav/useRequireAuth';
import { actions, cartCount, useApp, type CartLine } from '../../store/app';
import { haptic } from '../../telegram/tma';
import { Sum } from '../../ui/commerce';
import { Screen } from '../../ui/Screen';
import { Tag } from '../../ui/Tag';
import { sized } from '../../lib/img';

/** 7g · 7h · BF — корзина: конкретные вещи с состоянием, счётчик до остатка, проданная вещь, переход к оформлению. */
export function CartScreen() {
  const nav = useNav();
  const cart = useApp((s) => s.cart);
  const needAuth = useRequireAuth();
  const count = cartCount(cart);
  const goods = cart.filter((r) => !r.gone).reduce((s, r) => s + r.price * r.qty, 0);
  const live = cart.some((r) => !r.gone);

  const similar = (r: CartLine) => {
    const cat = ITEMS.find((x) => x.id === r.itemId)?.cat;
    actions.setFilter({ ...filt0(), cats: cat ? [cat] : [] });
    nav.root('/');
  };

  return (
    <Screen bare bar={live ? { total: rub(goods), totalLabel: 'Итого', btns: [{ label: 'Оформить', kind: 'primary', on: () => needAuth('/checkout') }] } : undefined}>
      <div style={{ padding: 'calc(16px + var(--safe-top)) var(--px) 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 'var(--f-h1)', fontWeight: 600, letterSpacing: '-0.03em' }}>Корзина</h1>
            {cart.length > 0 && count > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 10px', borderRadius: 999, background: 'var(--lime)', fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em' }}>{count} {plural(count, 'вещь', 'вещи', 'вещей')}</span>}
          </div>
          {cart.length > 0 && (
            <button type="button" onClick={() => nav.root('/')} className="pressable-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', border: 0, borderRadius: 999, background: 'var(--lb-lime-soft)', boxShadow: 'inset 0 0 0 1px var(--lb-limedeep-a40)', fontSize: 'var(--f-small)', fontWeight: 600, cursor: 'pointer', flex: 'none' }}>
              <Plus size={14} strokeWidth={2.4} aria-hidden /><span>Добавить ещё</span>
            </button>
          )}
        </div>

        {cart.length === 0 ? <EmptyCart onCatalog={() => nav.root('/')} onLink={() => nav.root('/link')} /> : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              {cart.map((r) => <Row key={r.key} r={r} onSimilar={() => similar(r)} />)}
            </div>
            {live && (
              <div style={{ marginTop: 18 }}>
                <Sum rows={[{ label: 'Товары', value: rub(goods) }, { label: 'Итого', value: rub(goods), total: true }]} note="Доставка по России считается при оформлении." />
              </div>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}

function Row({ r, onSimilar }: { r: CartLine; onSimilar: () => void }) {
  const qtyBtn = (off: boolean): CSSProperties => ({ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, background: 'none', borderRadius: 999, fontSize: 17, fontWeight: 700, color: off ? 'var(--lb-n-300)' : 'var(--lb-ink)', cursor: off ? 'default' : 'pointer', lineHeight: 1 });
  const setQty = (q: number) => { haptic.light(); actions.setCartQty(r.key, q); };
  return (
    <div style={{ padding: 12, borderRadius: 18, background: r.gone ? 'var(--lb-n-50)' : 'var(--lb-white)', boxShadow: `inset 0 0 0 1px ${r.gone ? 'var(--lb-ink-a10)' : 'var(--lb-ink-a08)'}` }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div role="img" aria-label={r.name} style={{ width: 68, height: 68, borderRadius: 13, flex: 'none', backgroundImage: `url(${sized(r.img, 240)})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: r.gone ? 'grayscale(1)' : 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--f-name)', fontWeight: 600, lineHeight: 1.3 }}>{r.name}</div>
            <button type="button" aria-label="Убрать из корзины" onClick={() => actions.removeCartLine(r.key)} className="pressable-xs"
              style={{ width: 44, height: 44, margin: '-12px -12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, background: 'none', color: 'var(--lb-ink)', cursor: 'pointer', flex: 'none' }}>
              <Trash2 size={17} strokeWidth={1.9} aria-hidden />
            </button>
          </div>
          <div style={{ marginTop: 4, fontSize: 'var(--f-small)' }}>{r.params}</div>
          <div style={{ marginTop: 8, display: 'flex' }}><Tag cond={r.cond} /></div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>{rub(r.price * r.qty)}</div>
            {!r.gone && (
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--neu)', borderRadius: 999, flex: 'none' }}>
                <button type="button" aria-label="Меньше" aria-disabled={r.qty <= 1} onClick={() => r.qty > 1 && setQty(r.qty - 1)} style={qtyBtn(r.qty <= 1)}>−</button>
                <span aria-live="polite" style={{ minWidth: 18, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>{r.qty}</span>
                <button type="button" aria-label="Больше" aria-disabled={r.qty >= r.max} onClick={() => r.qty < r.max && setQty(r.qty + 1)} style={qtyBtn(r.qty >= r.max)}>+</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {r.gone && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--line)', fontSize: 'var(--f-small)', lineHeight: 1.45 }}>
          <div style={{ fontWeight: 600 }}>Эту вещь уже купили</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => actions.removeCartLine(r.key)} className="pressable" style={{ minHeight: 44, padding: '0 16px', border: 0, borderRadius: 12, background: 'var(--dark)', color: 'var(--lb-white)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Убрать</button>
            <button type="button" onClick={onSimilar} className="pressable" style={{ minHeight: 44, padding: '0 16px', border: 0, borderRadius: 12, background: 'var(--lb-lime-soft)', boxShadow: 'inset 0 0 0 1px var(--lb-limedeep-a40)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Похожие вещи</button>
          </div>
        </div>
      )}
      {r.single && !r.gone && <div style={{ marginTop: 10, fontSize: 'var(--f-small)', lineHeight: 1.4 }}>Один экземпляр</div>}
    </div>
  );
}

function EmptyCart({ onCatalog, onLink }: { onCatalog: () => void; onLink: () => void }) {
  return (
    <div style={{ minHeight: 560, marginTop: 40, padding: '0 6px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
      <svg aria-hidden width="150" height="150" viewBox="0 0 120 128" style={{ alignSelf: 'center', marginBottom: 24, display: 'block' }}>
        <ellipse cx="60" cy="116" rx="40" ry="7" fill="var(--lb-ink-a14)" />
        <polygon points="60,16 102,40 60,64 18,40" fill="#C6FF00" />
        <polygon points="18,40 60,64 60,108 18,84" fill="#D4D4CE" />
        <polygon points="102,40 60,64 60,108 102,84" fill="#E8E8E5" />
        <polygon points="35,30.3 43,25.7 85,49.7 77,54.3" fill="var(--lb-ink-a18)" />
        <polygon points="77,54.3 85,49.7 85,93.7 77,98.3" fill="var(--lb-ink-a10)" />
        <polygon points="60,16 102,40 60,64 18,40" fill="none" stroke="var(--lb-ink-a14)" strokeWidth="1" />
        <polygon points="18,40 60,64 102,40 102,84 60,108 18,84" fill="none" stroke="var(--lb-ink-a14)" strokeWidth="1" />
      </svg>
      <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.025em' }}>Здесь пока ничего нет</div>
      <div style={{ marginTop: 10, fontSize: 'var(--f-body)', lineHeight: 1.5, color: 'var(--ink2)', textWrap: 'pretty' }}>Добавьте вещь из каталога или оформите заказ по ссылке из-за границы.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
        <button type="button" onClick={onCatalog} className="btn btn--primary">В каталог</button>
        <button type="button" onClick={onLink} className="btn btn--limeSoft">Заказать по ссылке</button>
      </div>
    </div>
  );
}
