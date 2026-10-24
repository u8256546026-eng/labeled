import { MessageCircle } from 'lucide-react';
import { FAQ } from '../../mocks/content';
import { useNav } from '../../nav/useNav';
import { Cards, H } from '../../ui/blocks';
import { ic } from '../../ui/icons';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { useSheet } from '../../ui/Sheet';
import { openSupport, supportUrl } from '../../ui/support';

/** AT — помощь: чат с ботом поддержки, частые вопросы листами, документы. */
export function HelpScreen() {
  const nav = useNav();
  const sheet = useSheet();
  const faq = (k: keyof typeof FAQ) => () => sheet.open({ title: FAQ[k].title, text: FAQ[k].text, btns: [{ label: 'Понятно', kind: 'ghost' }] });
  const ready = !!supportUrl();
  return (
    <Screen header={<Header title="Помощь" />}>
      <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8, padding: '20px 16px 16px', borderRadius: 20, background: 'var(--lb-ink-2)', color: 'var(--lb-white)' }}>
        <div aria-hidden style={{ position: 'absolute', right: -36, top: -36, width: 140, height: 140, borderRadius: 999, background: 'var(--lb-lime-a10)' }} />
        <div aria-hidden style={{ position: 'relative', width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--lime)', color: 'var(--lb-ink)' }}><MessageCircle size={22} strokeWidth={2} /></div>
        <div style={{ position: 'relative', marginTop: 6, fontSize: 21, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.12 }}>Напишите нам в Telegram</div>
        <div style={{ position: 'relative', fontSize: 12.5, lineHeight: 1.45, color: 'var(--lb-white-a80)', maxWidth: 290, textWrap: 'pretty' }}>
          {ready ? 'Ответит менеджер labeled. По заказу пишите из его карточки — номер подставим сами.' : 'Чат поддержки пока не подключён. Ответы на частые вопросы — ниже.'}
        </div>
        <button type="button" aria-disabled={!ready} onClick={() => ready && openSupport('help')} className="pressable"
          style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, marginTop: 8, border: 0, borderRadius: 14, background: ready ? 'var(--lime)' : 'var(--lb-white-a25)', color: ready ? 'var(--lb-ink)' : 'var(--lb-white-a72)', fontSize: 14.5, fontWeight: 600, cursor: ready ? 'pointer' : 'default' }}>Написать в поддержку</button>
      </div>
      <H text="Частые вопросы" />
      <Cards rows={[
        { ...ic('link'), title: 'Как устроен заказ по ссылке', sub: 'Заявка → подтверждение → оплата → выкуп → доставка', on: faq('how') },
        { ...ic('calc'), title: 'Как считается стоимость', sub: 'Курс с надбавкой, комиссия за штуку, услуги', on: faq('price') },
        { ...ic('shield'), title: 'Условия услуг и возврата', sub: 'Фотоотчёт, коробка, защита · из-за границы без возврата', on: faq('terms') },
      ]} />
      <H text="Документы" />
      <Cards rows={[{ ...ic('doc'), title: 'Оферта и политика данных', sub: 'Условия продажи и обработки персональных данных', on: () => nav.go('/legal') }]} />
    </Screen>
  );
}
