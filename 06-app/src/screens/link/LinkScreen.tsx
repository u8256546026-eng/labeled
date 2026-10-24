import { Plus, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { errorText } from '../../api/client';
import { linkApi } from '../../api/link';
import { useOrders } from '../../api/useOrders';
import { calcLink, itemSum, emptyForm, type LinkItem } from '../../domain/linkOrder';
import { num, plural, rub, yuan } from '../../lib/format';
import { useApi } from '../../lib/useApi';
import { useAttempt } from '../../lib/attempt';
import { useNav } from '../../nav/useNav';
import { actions, appStore, useApp } from '../../store/app';
import { haptic, openTg } from '../../telegram/tma';
import { Btns } from '../../ui/Btn';
import { H, Note, P, Skel, Tog, type TogSpec } from '../../ui/blocks';
import { Fields, Input, Items, Radio, Sum } from '../../ui/commerce';
import { Header } from '../../ui/Header';
import { OrderCard } from '../../ui/orderBlocks';
import { ReviewsLine } from '../../ui/ReviewsLine';
import { Screen } from '../../ui/Screen';
import { useSheet, type SheetSpec } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { supportUrl } from '../../ui/support';

const cnyRate = (r: number) => r.toFixed(2).replace('.', ',');

/** «Poizon, ссылка poizon.com/…» для текста обращения. */
export const linkAbout = (it?: Pick<LinkItem, 'plat' | 'url'>) => (it?.url ? `${it.plat || 'Свой вариант'}, ссылка ${it.url}` : undefined);

const TABS = [{ key: 'form', label: 'Оформить' }, { key: 'hist', label: 'История' }];

/** Лист «Помощь с размером»: поддержка в Telegram с подготовленным текстом. */
/** about — что за вещь: «Poizon, ссылка …» или название товара из каталога. */
export function sizeHelpSheet(about?: string): SheetSpec {
  const quote = 'Здравствуйте! Нужна помощь с размером' + (about ? ': ' + about + '.' : '.');
  const url = supportUrl('size', quote);
  return {
    title: 'Помощь с размером',
    text: 'Откроем поддержку в Telegram с подготовленным текстом.',
    quote,
    btns: [{ label: 'Открыть Telegram', kind: 'primary', dis: !url, on: () => { if (url) openTg(url); } }, { label: 'Отмена', kind: 'ghost' }],
  };
}

/** Фотоотчёт или коробка для всех позиций сразу: включён, если выбран у каждой; нажатие включает у всех или снимает у всех. */
function perItemRow(key: 'photo' | 'box', label: string, items: LinkItem[], set: (p: { items: LinkItem[] }) => void): TogSpec {
  const n = items.length;
  const k = items.filter((it) => it[key]).length;
  const all = n > 0 && k === n;
  const sub = !n ? 'Сначала добавьте товар'
    : all ? (n > 1 ? 'Для всех позиций' : 'Для этой позиции')
    : k ? `Выбрано у ${k} из ${n} ${plural(n, 'позиции', 'позиций', 'позиций')} · нажмите, чтобы включить для всех`
    : n > 1 ? 'Включится для всех позиций' : 'Для этой позиции';
  return { label, sub, on_: all, dis: !n, act: () => set({ items: appStore.get().link.items.map((it) => ({ ...it, [key]: !all })) }) };
}

/** B · F · AW-вход — третий раздел «Заказ по ссылке»: форма заявки с расчётом и история. */
export function LinkScreen() {
  const [tab, setTab] = useState<'form' | 'hist'>('form');
  return tab === 'form' ? <LinkForm onTab={setTab} /> : <LinkHistory onTab={setTab} />;
}

function LinkForm({ onTab }: { onTab: (t: 'form' | 'hist') => void }) {
  const nav = useNav();
  const sheet = useSheet();
  const toast = useToast();
  const L = useApp((s) => s.link);
  const pts = useApp((s) => s.pts);
  const email = useApp((s) => s.email);
  const addr = useApp((s) => s.addrs[s.addrSel]);
  const rates = useApi(() => linkApi.rates(), [], 'rates');
  const [sending, setSending] = useState(false);
  const attempt = useAttempt();
  const set = actions.setLink;

  const c = rates.data ? calcLink(rates.data, L, pts, email === 'ok') : null;
  const n = L.items.length;
  const valid = !!L.title.trim() && n > 0 && !!addr && !!c;

  const saveDraft = () => {
    actions.saveLinkDraft();
    sheet.open({ title: 'Черновик сохранён', text: 'Продолжить редактирование можно во вкладке «История».', btns: [{ label: 'К истории', kind: 'primary', on: () => onTab('hist') }, { label: 'Продолжить', kind: 'ghost' }] });
  };
  const remove = (it: LinkItem) => sheet.open({
    title: 'Удалить позицию?', text: 'Позиция исчезнет из заявки. Расчёт пересчитается.',
    btns: [{ label: 'Удалить', kind: 'danger', on: () => set({ items: appStore.get().link.items.filter((x) => x.key !== it.key) }) }, { label: 'Оставить', kind: 'ghost' }],
  });
  const submit = () => {
    if (!c || !attempt.start()) return;
    setSending(true);
    linkApi.submit(L, c, attempt.key(), addr?.id).then((r) => {
      actions.linkSubmitted(r, emptyForm());
      haptic.success();
      nav.root('/link/sent/' + r.num);
    }, (e) => { attempt.fail(); setSending(false); haptic.error(); toast(errorText(e, 'Не получилось отправить заявку — попробуйте ещё раз'), 'error'); });
  };

  return (
    <Screen
      header={<Header title="Заказ по ссылке" tabs={TABS} tab="form" onTab={(k) => onTab(k as 'form' | 'hist')}
        sub={`${n} ${plural(n, 'позиция', 'позиции', 'позиций')} · ${L.dirty ? 'есть несохранённые изменения' : 'черновик сохранён'} · оплата после одобрения`}
        btn={{ label: 'В черновик', on: saveDraft, icon: <Save size={14} strokeWidth={2.3} color="#C6FF00" aria-hidden /> }} />}
      bar={{ total: c ? rub(c.total) : '—', totalLabel: 'Итого', btns: [{ label: 'Отправить на проверку', kind: 'primary', dis: !valid || sending, on: submit }] }}>
      <Input label="Название заказа" value={L.title} max={16} ph="Например, осенний дроп" onChange={(v) => set({ title: v.slice(0, 16) })} />

      <H text="Позиции" sub={(rates.data ? `Курс ЦБ ${cnyRate(rates.data.rate)} ₽ за 1 ¥${rates.data.rateDate ? ' на ' + rates.data.rateDate : ''}. ` : '') + 'Разные размеры оформляются отдельными позициями.'} />
      {n > 0 && rates.data && (
        <Items rows={L.items.map((it) => ({
          key: it.key,
          name: `${it.plat || 'Свой вариант'} · ${yuan(it.price)} за штуку`,
          params: `${it.url}\nРазмер ${it.size || '—'} · ${it.qty} шт`,
          price: rub(itemSum(rates.data!, it)), img: it.pic?.preview,
          serv: [it.photo ? 'фотоотчёт' : '', it.box ? 'коробка' : ''].filter(Boolean),
          acts: [{ label: 'Изменить', kind: 'ghost', on: () => nav.go('/link/item/' + it.key) }, { label: 'Удалить', kind: 'danger', on: () => remove(it) }],
        }))} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button type="button" onClick={() => nav.go('/link/item/new')} className="pressable"
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 62, padding: '10px 12px', border: '1.5px dashed var(--lb-ink-a28)', borderRadius: 18, background: 'transparent', color: 'var(--lb-ink)', textAlign: 'left', cursor: 'pointer' }}>
          <span aria-hidden style={{ width: 38, height: 38, flex: 'none', borderRadius: 12, background: 'var(--lime)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} strokeWidth={2.2} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{n ? 'Добавить ещё один товар' : 'Добавить товар'}</span>
            <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, lineHeight: 1.35, color: 'var(--lb-ink-2)' }}>Ссылка с Poizon, Taobao или 1688</span>
          </span>
        </button>
        <button type="button" onClick={() => sheet.open(sizeHelpSheet(linkAbout(L.items[0])))}
          style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '0 4px', border: 0, background: 'transparent', fontSize: 12.5, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'var(--lb-ink-a28)', cursor: 'pointer' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><rect x="1.5" y="5" width="13" height="6" rx="1.5" stroke="#111111" strokeWidth="1.4" /><path d="M4.5 5v2.2M7 5v1.5M9.5 5v2.2M12 5v1.5" stroke="#111111" strokeWidth="1.3" strokeLinecap="round" /></svg>
          <span>Не знаете размер? Поможем подобрать</span>
        </button>
      </div>

      <H text="Дополнительные услуги" />
      <P>Фотоотчёт и коробку можно включить здесь сразу для всех позиций или у каждой позиции отдельно — на карточках выше видно, к каким товарам они относятся.</P>
      <Tog rows={[
        perItemRow('photo', `Фотоотчёт — ${rates.data?.photo ?? 200} ₽ за штуку`, L.items, set),
        perItemRow('box', `Коробка — ${rates.data?.box ?? 200} ₽ за штуку`, L.items, set),
        { label: `Защита от рисков — ${rates.data?.protectPct ?? 1}%`, sub: 'Считается от стоимости товаров без комиссии и доставки.', on_: L.protect, act: () => set({ protect: !L.protect }) },
      ]} />

      <H text="Адрес" />
      <Fields rows={[{ label: 'Адрес получения', value: addr ? `${addr.name} · ${addr.city}, ${addr.line}` : '', ph: 'Выберите или добавьте адрес', on: () => nav.go('/addresses') }]} />

      <H text="Отправка" />
      <Radio label="Отправка" rows={[
        { label: 'Дождаться всех товаров', sub: 'Отправим одной посылкой, когда все вещи будут на складе', on_: L.ship === 'all', act: () => set({ ship: 'all' }) },
        { label: 'Отправлять готовые частями', sub: 'Каждая посылка едет отдельно, доставка оплачивается по каждой', on_: L.ship === 'parts', act: () => set({ ship: 'parts' }) },
      ]} />

      <H text="Скидка" />
      <Radio label="Скидка" rows={[
        { label: 'Списать баллы', sub: `Доступно ${num(pts)} Б · до 30% стоимости товаров с комиссией`, right: c ? '−' + rub(c.maxPts) : undefined, on_: L.disc === 'points', act: () => set({ disc: 'points' }), dis: !!c && c.maxPts === 0 },
        { label: 'Скидка 50% на комиссию', sub: email === 'ok' ? 'Первый заказ, почта подтверждена' : 'Нужно привязать и подтвердить почту', right: c ? '−' + rub(c.commOff) : undefined, dis: email !== 'ok', on_: L.disc === 'comm', act: () => set({ disc: 'comm' }) },
        { label: 'Не применять', sub: 'Баллы и скидка на комиссию вместе не применяются', on_: L.disc === 'none', act: () => set({ disc: 'none' }) },
      ]} />
      {email !== 'ok' && <Btns items={[{ label: 'Привязать почту', kind: 'limeSoft', on: () => nav.go('/email') }]} />}

      <H text="Расчёт" />
      {rates.error ? (
        <Note tone="err" title="Расчёт недоступен" text="Не удалось получить курс — сумма не рассчитана. Мы не показываем нулевую стоимость." act={{ label: 'Повторить расчёт', on: rates.reload }} />
      ) : !c || !rates.data ? <Skel n={2} /> : (
        <Sum rows={[
          { label: 'Товары по расчётному курсу', value: rub(c.goods) },
          { label: 'Комиссия', value: rub(c.comm) },
          { label: 'Услуги (фотоотчёт, коробка)', value: c.serv ? rub(c.serv) : '—' },
          { label: 'Защита от рисков', value: c.prot ? rub(c.prot) : '—' },
          { label: L.disc === 'comm' ? 'Скидка на комиссию' : 'Списание баллов', value: c.disc ? '−' + rub(c.disc) : '—' },
          { label: 'Итого', value: rub(c.total), total: true },
        ]} note={`Курс ЦБ ${cnyRate(rates.data.rate)} ₽ за 1 ¥${rates.data.rateDate ? ' на ' + rates.data.rateDate : ''} плюс надбавка ${rates.data.markup.map((t) => t.value.toFixed(2).replace('.', ',')).join(' / ')} ₽ по цене одной вещи. Доставка из-за границы оплачивается отдельно после поступления на склад в Китае.`} />
      )}
      <ReviewsLine onOpen={() => nav.go('/reviews')} />
    </Screen>
  );
}

function LinkHistory({ onTab }: { onTab: (t: 'form' | 'hist') => void }) {
  const nav = useNav();
  const drafts = useApp((s) => s.linkDrafts);
  const all = useOrders().orders;
  const orders = useMemo(() => all?.filter((o) => o.kind === 'link') ?? null, [all]);
  const nd = drafts.length, no = orders?.length ?? 0;

  return (
    <Screen header={<Header title="Заказ по ссылке" tabs={TABS} tab="hist" onTab={(k) => onTab(k as 'form' | 'hist')}
      sub={`${nd} ${plural(nd, 'черновик', 'черновика', 'черновиков')} · ${no} ${plural(no, 'заявка и заказ', 'заявки и заказа', 'заявок и заказов')}`} />}>
      {nd > 0 && (
        <>
          <H text="Черновики" />
          {drafts.map((d) => (
            <OrderCard key={d.id} pre="" title={d.form.title || 'Без названия'} name="" kind="" status="Черновик" tone="off" thumbs={[]}
              meta={`Черновик · ${d.date} · ${d.form.items.length} ${plural(d.form.items.length, 'позиция', 'позиции', 'позиций')}`}
              onClick={() => { actions.openLinkDraft(d.id); onTab('form'); }} />
          ))}
        </>
      )}
      <H text="Заявки и заказы" />
      {!orders ? <Skel n={2} /> : orders.map((o) => (
        <OrderCard key={o.num} pre={o.pre} num={o.num} name={o.name} kind="" status={o.listStatus ?? o.status} meta={o.listMeta} tone={o.listTone ?? o.tone} thumbs={o.thumbs} dead={!!o.stopped}
          step={o.group === 'decision' ? undefined : Math.min(5, o.stage + 1)} of={o.group === 'decision' ? undefined : 5} onClick={() => nav.go('/order/' + o.num)} />
      ))}
    </Screen>
  );
}
