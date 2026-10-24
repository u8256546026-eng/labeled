import { Star } from 'lucide-react';
import { linkApi } from '../../api/link';
import { pointsApi } from '../../api/profile';
import { calcLink } from '../../domain/linkOrder';
import { num, rub } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { useNav } from '../../nav/useNav';
import { useApp } from '../../store/app';
import { Skel } from '../../ui/blocks';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';

const card = { padding: 14, borderRadius: 18, background: 'var(--lb-white)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)' } as const;

/** H — баллы: баланс, правила списания и реферальной награды, пример «баллы или скидка», история. */
export function PointsScreen() {
  const nav = useNav();
  const pts = useApp((s) => s.pts);
  const link = useApp((s) => s.link);
  const rates = useApi(() => linkApi.rates(), [], 'rates');
  const hist = useApi(() => pointsApi.history(), [], 'points', { live: true });
  const c = rates.data && link.items.length ? calcLink(rates.data, { ...link, disc: 'none' }, pts, true) : null;

  return (
    <Screen header={<Header title="Баллы" />} bar={{ btns: [{ label: 'Пригласить друга', kind: 'primary', on: () => nav.go('/invite') }] }}>
      <div style={{ position: 'relative', overflow: 'hidden', padding: 16, borderRadius: 20, background: 'var(--lb-ink-2)', color: 'var(--lb-white)' }}>
        <div aria-hidden style={{ position: 'absolute', right: -18, top: -18, width: 120, height: 120, borderRadius: 999, background: 'var(--lb-lime-a10)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}><Star size={15} strokeWidth={2.3} color="#C6FF00" aria-hidden /><span style={{ fontSize: 11.5, fontWeight: 600 }}>Баланс</span></div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1 }}>{num(pts)}</span><span style={{ fontSize: 14, fontWeight: 600 }}>баллов</span>
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 10px', borderRadius: 999, background: 'var(--lime)', color: 'var(--lb-ink)', fontSize: 11.5, fontWeight: 700 }}>1 балл = 1 ₽</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 10px', borderRadius: 999, background: 'var(--lb-white-a14)', fontSize: 11.5, fontWeight: 600 }}>Списание до 30% стоимости товаров с комиссией</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: 12, borderRadius: 18, background: 'var(--lime)' }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>+250</div>
          <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.4, textWrap: 'pretty' }}>за друга — после его первого выполненного заказа</div>
        </div>
        <div style={{ padding: 12, borderRadius: 18, background: 'var(--lb-n-150)' }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 }}>−50%</div>
          <div style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.4, textWrap: 'pretty' }}>комиссии в первом заказе после подтверждения почты</div>
        </div>
      </div>
      {c && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Баллы или скидка — что-то одно</div>
          <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.4, color: 'var(--lb-ink-2)' }}>Пример для заявки на {rub(c.goods + c.comm)} (товары и комиссия):</div>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginTop: 12 }}>
            <Example label="Баллы" value={'−' + rub(c.maxPts)} />
            <div aria-hidden style={{ flex: 'none', alignSelf: 'center', fontSize: 11, fontWeight: 700 }}>или</div>
            <Example label="Скидка на комиссию" value={'−' + rub(c.commOff)} />
          </div>
          <div style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.4, color: 'var(--lb-ink-2)', textWrap: 'pretty' }}>При оформлении показываем выгоду каждого варианта и итог. Доставка и услуги в базу списания не входят.</div>
        </div>
      )}
      <div role="note" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 16, background: 'var(--lb-danger-soft)', boxShadow: 'inset 0 0 0 1px var(--lb-danger-a25)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#C2341D" aria-hidden style={{ flex: 'none', marginTop: 1 }}><path d="M12 3.4 22 20.6H2Z" /><path d="M12 9.6v4.6" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" /><circle cx="12" cy="17.6" r="1.2" fill="#FFFFFF" /></svg>
        <div style={{ fontSize: 11.5, lineHeight: 1.45, textWrap: 'pretty' }}>Списанные баллы при отмене заказа не возвращаются. Награда за друга аннулируется, если его первый заказ отменён или возвращён.</div>
      </div>
      <div style={{ ...card, padding: '4px 14px' }}>
        {!hist.data ? <div style={{ padding: '10px 0' }}><Skel n={2} /></div> : hist.data.map((h, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i ? '1px solid var(--lb-ink-a08)' : 'none' }}>
            <div aria-hidden style={{ width: 32, height: 32, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: h.plus ? 'var(--lime)' : 'var(--lb-n-150)', fontSize: 16, fontWeight: 700 }}>{h.plus ? '+' : '−'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{h.title}</div>
              <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--lb-ink-2)' }}>{h.date}</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{(h.plus ? '+' : '−') + num(h.amount)}</div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

function Example({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 0, padding: 12, borderRadius: 14, background: 'var(--lb-n-50)', boxShadow: 'inset 0 0 0 1px var(--lb-ink-a08)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--lb-ink-2)' }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}
