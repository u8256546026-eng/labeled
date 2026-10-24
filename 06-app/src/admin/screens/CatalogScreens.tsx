import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { plural, rub } from '../../lib/format';
import { useNav } from '../../nav/useNav';
import { Btn } from '../../ui/Btn';
import { useSheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import type { AdmBanner, AdmColor, AdmItem, AdmOffer, AdmSizeReq } from '../../mocks/admin';
import { COLORS, colorFilter } from '../../mocks/catalog';
import { adminApi, adminDb, adminLoad, adminUploads, useAdmin, useCan, type BannerInput } from '../api';
import { useAction, useLoad } from '../hooks';
import type { PillTone } from '../model';
import { AChips, AdminLoading, AEmpty, ANote, AH, AdminScreen, BtnRow, Field, PhotoGrid, RadioList, Rows, Search, TogList } from '../ui';

type Status = 'live' | 'empty' | 'hidden';
const statusOf = (it: AdmItem): Status => (!it.show ? 'hidden' : it.offers.every((o) => o.qty === 0) ? 'empty' : 'live');
const PL: Record<Status, [string, PillTone]> = { live: ['В продаже', 'live'], empty: ['Нет размеров', 'err'], hidden: ['Скрыта', 'n'] };

function priceLabel(it: AdmItem): string {
  const ps = it.offers.filter((o) => o.price > 0).map((o) => o.price);
  if (!ps.length) return 'цена не указана';
  const min = Math.min(...ps);
  return (new Set(ps).size > 1 ? 'от ' : '') + rub(min);
}

/** adm14 — вещи из наличия: статус, число предложений, цена. Вверху — заявки на размер и витрина. «Добавить» открывает пустую карточку. */
export function AdminCatalogScreen() {
  const nav = useNav();
  const can = useCan();
  const items = useAdmin((s) => s.items);
  const banners = useAdmin((s) => s.banners.length);
  const cats = useAdmin((s) => s.cats.length);
  const sizesWait = useAdmin((s) => s.sizes.filter((x) => x.state === 'wait').length);
  const [q, setQ] = useState('');
  const [cf, setCf] = useState<Status | 'all'>('all');
  const L = useLoad(() => Promise.all([adminLoad.items(), adminLoad.sizes(), can('banners') ? adminLoad.showcase() : Promise.resolve()]), []);
  if (!L.ready) return <AdminLoading title="Каталог" error={L.error} retry={L.reload} />;
  const hidden = items.filter((x) => statusOf(x) === 'hidden').length;
  const ql = q.trim().toLowerCase();
  const list = items.filter((x) => (cf === 'all' || statusOf(x) === cf) && (!ql || (x.name + ' ' + x.brand).toLowerCase().includes(ql)));
  return (
    <AdminScreen title="Каталог" sub={`${items.length} ${plural(items.length, 'вещь', 'вещи', 'вещей')} · ${hidden} ${plural(hidden, 'скрыта', 'скрыты', 'скрыто')}`} btn={{ label: 'Добавить', on: () => nav.go('/admin/item/new') }}>
      <Search ph="Название или бренд" value={q} onChange={setQ} />
      <Rows items={[
        { icon: 'tag', title: 'Заявки на размер', sub: 'Покупатели ждут отсутствующий размер', pill: sizesWait ? `${sizesWait} ${plural(sizesWait, 'ждёт', 'ждут', 'ждут')}` : null, tone: 'wait', on: () => nav.go('/admin/sizes') },
        ...(can('banners') ? [{ icon: 'image' as const, title: 'Баннеры и категории', sub: `${banners} ${plural(banners, 'баннер', 'баннера', 'баннеров')} · ${cats} ${plural(cats, 'категория', 'категории', 'категорий')}`, on: () => nav.go('/admin/banners') }] : []),
      ]} />
      <AChips label="Статус вещи" items={([['all', 'Все'], ['live', 'В продаже'], ['empty', 'Нет размеров'], ['hidden', 'Скрыты']] as [Status | 'all', string][]).map(([k, label]) => ({ label, n: k === 'all' ? null : items.filter((x) => statusOf(x) === k).length, on_: cf === k, act: () => setCf(k) }))} />
      {list.length === 0
        ? <AEmpty icon="tag" title="Ничего не нашлось" text="Измените фильтр или запрос." />
        : <Rows items={list.map((x) => ({ img: x.img, title: x.name, sub: `${x.brand} · ${x.colors.length > 1 ? `${x.colors.length} ${plural(x.colors.length, 'цвет', 'цвета', 'цветов')} · ` : ''}${x.offers.length} ${plural(x.offers.length, 'предложение', 'предложения', 'предложений')} · ${priceLabel(x)}`, pill: PL[statusOf(x)][0], tone: PL[statusOf(x)][1], on: () => nav.go('/admin/item/' + x.id) }))} />}
    </AdminScreen>
  );
}

const CONDS = ['Новое · бирки на месте', 'Новое · без бирок', 'Как новое', 'Чуть уставшее'];
/** Цвет для выбора: название и цвет фильтра, в котором вещь найдут покупатели. */
type ColorOpt = { name: string; filter: string };
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** Справочник фильтра и свои цвета, которые продавец уже давал другим вещам («Оливковый» → зелёный). */
const colorOpts = (items: AdmItem[]): ColorOpt[] => {
  const own: ColorOpt[] = [];
  items.flatMap((x) => x.colors).forEach((c) => {
    if (!colorFilter(c.name) && c.filter && !own.some((o) => same(o.name, c.name))) own.push({ name: c.name.trim(), filter: c.filter });
  });
  return [...COLORS.map((c) => ({ name: c.name, filter: c.id })), ...own.sort((a, b) => a.name.localeCompare(b.name, 'ru'))];
};
const newId = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const blank = (): AdmItem => {
  const c = newId('c');
  return { id: newId('it'), name: '', brand: '', description: '', img: '', cat: 'Футболки', colors: [{ id: c, name: 'Чёрный', pics: [] }], show: true, preorder: false, offers: [{ id: newId('o'), color: c, cond: CONDS[0], size: 'M', price: 0, qty: 1 }] };
};

/**
 * adm15 — вещь: расцветки с фото, описание и предложения. Одна модель в разных цветах — одна вещь,
 * покупатель переключает цвет в карточке. У каждой расцветки свои предложения (состояние, размер, цена, остаток);
 * 0 — предложение скрыто. Изменения сохраняются кнопкой.
 */
export function AdminItemScreen() {
  const { id = 'new' } = useParams();
  const L = useLoad(() => Promise.all([adminLoad.items(), adminLoad.showcase()]), []);
  if (!L.ready) return <AdminLoading title="Вещь" error={L.error} retry={L.reload} />;
  return <ItemEditor key={id} id={id} />;
}

function ItemEditor({ id }: { id: string }) {
  const nav = useNav();
  const sheet = useSheet();
  const toast = useToast();
  const { busy, run } = useAction();
  const items = useAdmin((s) => s.items);
  const src = items.find((x) => x.id === id);
  const others = items.filter((x) => x.id !== id);
  const cats = useAdmin((s) => s.cats);
  const [it, setIt] = useState<AdmItem>(() => (src ? structuredClone(src) : blank()));
  // «Размеры под заказ» — текстом через запятую; в вещь уходит список (черновик текста хранится отдельно, чтобы запятая не пропадала при наборе).
  const [preText, setPreText] = useState(() => (it.preorderSizes ?? []).join(', '));
  // Новая или нет — по моменту открытия: после удаления вещь пропадает из списка, а экран ещё виден до возврата назад.
  const [isNew] = useState(() => !src);
  const set = (p: Partial<AdmItem>) => setIt((x) => ({ ...x, ...p }));
  const setColor = (cid: string, p: Partial<AdmColor>) => setIt((x) => ({ ...x, colors: x.colors.map((c) => (c.id === cid ? { ...c, ...p } : c)) }));
  const multi = it.colors.length > 1;
  const itCats = it.cats?.length ? it.cats : [it.cat];
  const noPics = it.colors.find((c) => !c.pics.length);
  const ok = !!it.name.trim() && !noPics && it.offers.some((o) => o.price > 0);
  // Обложку (img) не сравниваем: с сервера приходит уменьшенная копия первого фото.
  const dirty = !src || JSON.stringify({ ...src, img: '' }) !== JSON.stringify({ ...it, img: '' });
  const payload = (next: AdmItem) => ({ ...next, img: next.colors[0]?.pics[0] ?? next.img });
  const save = (next: AdmItem, msg: string) => run(() => adminApi.saveItem(payload(next)), () => { toast(msg); if (isNew) nav.back(); });
  const opts = colorOpts(items);

  const askDelete = () => sheet.open({
    title: `Удалить «${it.name || 'вещь'}»?`,
    text: 'Вещь пропадёт из каталога и админки, вернуть её не получится. Заказы с ней не изменятся, заявки на размер этой вещи удалятся. Если вещь ещё может вернуться в продажу — лучше снять её с продажи.',
    btns: [
      { label: 'Удалить вещь', kind: 'danger', on: () => run(() => adminApi.deleteItem(it.id), () => { nav.back(); toast('Вещь удалена'); }) },
      { label: 'Отмена', kind: 'ghost' },
    ],
  });

  const editOffer = (color: string, o: AdmOffer | null) => sheet.open({ title: o ? 'Предложение' : 'Новое предложение', text: 'Состояние, размер, цена и остаток. Остаток 0 — предложение не видно покупателям.', body: <OfferForm o={o} color={color} onSave={(x) => setIt((cur) => ({ ...cur, offers: o ? cur.offers.map((y) => (y.id === o.id ? x : y)) : cur.offers.concat([x]) }))} onDelete={o ? () => setIt((cur) => ({ ...cur, offers: cur.offers.filter((y) => y.id !== o.id) })) : undefined} />, btns: [] });

  // Цвета, уже занятые другими расцветками этой вещи: два одинаковых цвета в одной вещи сервер не примет.
  const taken = (except = '') => it.colors.filter((c) => c.id !== except).map((c) => c.name);
  const pickColor = (title: string, c: AdmColor | null, on: (v: ColorOpt) => void) => sheet.open({ title, body: <ColorPick opts={opts} cur={c?.name ?? ''} taken={taken(c?.id)} on={on} />, btns: [] });
  const addColor = () => pickColor('Цвет новой расцветки', null, (v) => setIt((x) => ({ ...x, colors: x.colors.concat([{ id: newId('c'), ...v, pics: [] }]) })));
  const dropColor = (c: AdmColor) => {
    const drop = () => setIt((x) => ({ ...x, colors: x.colors.filter((y) => y.id !== c.id), offers: x.offers.filter((o) => o.color !== c.id) }));
    if (!it.offers.some((o) => o.color === c.id) && !c.pics.length) return drop();
    sheet.open({
      title: `Удалить расцветку «${c.name}»?`, text: 'Её фото и предложения уберутся из вещи после сохранения. Заказы с ней не изменятся.',
      btns: [{ label: 'Удалить расцветку', kind: 'danger', on: drop }, { label: 'Отмена', kind: 'ghost' }],
    });
  };
  const mainColor = (c: AdmColor) => setIt((x) => ({ ...x, colors: [c, ...x.colors.filter((y) => y.id !== c.id)] }));

  // Объединение: другая вещь (обычно та же модель, заведённая отдельно в другом цвете) становится расцветками этой.
  const askMerge = (x: AdmItem) => sheet.open({
    title: `Объединить с «${x.name}»?`,
    text: `${x.colors.length > 1 ? `Её цвета (${x.colors.map((c) => c.name).join(', ')}) с фото и предложениями станут расцветками` : `Её цвет «${x.colors[0]?.name ?? ''}» с фото и предложениями станет расцветкой`} этой вещи, заявки на размер перейдут сюда. В каталоге её карточка останется, а в карточке товара появится выбор цвета. Название, бренд и категория останутся от этой вещи.${dirty ? ' Сначала сохраним ваши изменения.' : ''}`,
    btns: [
      { label: 'Объединить', kind: 'primary', on: () => run(async () => {
        if (dirty) await adminApi.saveItem(payload(it));
        await adminApi.mergeItem(it.id, x.id);
      }, () => {
        const fresh = adminDb.get().items.find((y) => y.id === it.id);
        if (fresh) { setIt(structuredClone(fresh)); setPreText((fresh.preorderSizes ?? []).join(', ')); }
        toast('Вещи объединены');
      }) },
      { label: 'Отмена', kind: 'ghost' },
    ],
  });
  const pickMerge = () => {
    const key = (x: AdmItem) => (x.name.trim().toLowerCase() === it.name.trim().toLowerCase() ? 0 : x.brand.trim().toLowerCase() === it.brand.trim().toLowerCase() ? 1 : 2);
    const list = others.slice().sort((a, b) => key(a) - key(b));
    sheet.open({
      title: 'Объединить с другой вещью', text: 'Выберите ту же модель, заведённую отдельно в другом цвете. Она станет расцветкой этой вещи.',
      body: <div style={{ marginTop: 14 }}><Rows items={list.map((x) => ({ img: x.img, title: x.name, sub: `${x.brand} · ${x.colors.map((c) => c.name).join(', ')}`, on: () => askMerge(x) }))} /></div>, btns: [],
    });
  };

  const barLabel = ok ? 'Сохранить' : noPics ? (multi ? `Добавьте фото: ${noPics.name.toLowerCase()}` : 'Добавьте фото') : !it.name.trim() ? 'Укажите название' : 'Укажите цену';
  return (
    <AdminScreen title={isNew ? 'Новая вещь' : it.name || 'Без названия'} sub={it.show ? 'Видна в каталоге' : 'Скрыта из каталога'}
      bar={[{ label: barLabel, dis: !ok || busy, on: () => save(it, 'Сохранено') }]}>
      <Field label="Название" value={it.name} onChange={(v) => set({ name: v })} ph="Например: Футболка с принтом" />
      <Field label="Бренд" value={it.brand} onChange={(v) => set({ brand: v })} ph="Например: Stüssy" />
      <Field label="Описание" multi value={it.description} onChange={(v) => set({ description: v.slice(0, 2000) })} ph="Материал, посадка, особенности, на модели размер…" />
      <Rows items={[{ icon: 'tag', title: itCats.length > 1 ? 'Категории' : 'Категория', sub: itCats.join(', '), on: () => sheet.open({ title: 'Категории', text: 'Вещь появится в каталоге в каждой выбранной категории.', body: <CatPick opts={cats.map((c) => c.name)} cur={itCats} on={(v) => set({ cat: v[0], cats: v })} />, btns: [] }) }]} />
      <AH title="Расцветки" sub="Одна модель в разных цветах — одна вещь. В каталоге у каждого цвета своя карточка, в карточке товара покупатель переключает цвета." />
      {it.colors.map((c, i) => {
        const offs = it.offers.filter((o) => o.color === c.id);
        return (
          <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {multi && <AH title={c.name} sub={i === 0 ? 'Основная расцветка' : `Расцветка ${i + 1}`} link={i > 0 ? 'Сделать основной' : undefined} on={() => mainColor(c)} />}
            <Rows items={[{ icon: 'palette', title: 'Цвет', sub: colorSub(c), on: () => pickColor('Цвет', c, (v) => setColor(c.id, v)) }]} />
            <PhotoGrid title={multi ? 'Фото · ' + c.name.toLowerCase() : 'Фото'} sub={i === 0 || multi ? 'Первое фото — обложка в каталоге' : undefined} cnt={`${c.pics.length} из 3`} cntTone={c.pics.length ? 'live' : 'err'} ratio="4 / 5"
              items={[0, 1, 2].map((k) => (c.pics[k] ? { img: c.pics[k], aria: 'Убрать фото', on: () => setColor(c.id, { pics: c.pics.filter((_, j) => j !== k) }) } : { cap: 'Фото' }))}
              onPick={(files) => run(async () => {
                const urls = (await Promise.all(files.slice(0, 3 - c.pics.length).map((f) => adminUploads.itemPhoto(f)))).filter((x): x is string => !!x);
                setIt((x) => ({ ...x, colors: x.colors.map((y) => (y.id === c.id ? { ...y, pics: y.pics.concat(urls).slice(0, 3) } : y)) }));
              })} />
            {offs.length > 0 && <OfferList offers={offs} onEdit={(o) => editOffer(c.id, o)} onQty={(o, qty) => set({ offers: it.offers.map((y) => (y.id === o.id ? { ...y, qty } : y)) })} />}
            {!it.preorder && !offs.some((o) => o.qty > 0 && o.price > 0) && <ANote tone="n" text={`Нет предложений в наличии — покупатели не увидят ${multi ? 'этот цвет' : 'вещь'}.`} />}
            <BtnRow items={[
              { label: 'Добавить предложение', kind: 'limeSoft', on: () => editOffer(c.id, null) },
              ...(multi ? [{ label: 'Удалить расцветку', kind: 'dangerSoft' as const, on: () => dropColor(c) }] : []),
            ]} />
          </div>
        );
      })}
      <BtnRow items={[
        { label: 'Добавить расцветку', kind: 'limeSoft', on: addColor },
        ...(!isNew && others.length ? [{ label: 'Объединить с другой вещью', kind: 'ghost' as const, dis: busy || (dirty && !ok), on: pickMerge }] : []),
      ]} />
      <TogList items={[
        { label: 'Показывать в каталоге', sub: 'Скрытая вещь не видна покупателям', on_: it.show, act: () => set({ show: !it.show }) },
        { label: 'Размер под заказ', sub: 'Покупатель оставит заявку на размер, которого нет в наличии', on_: it.preorder, act: () => set({ preorder: !it.preorder }) },
      ]} />
      {it.preorder && <Field label="Размеры под заказ" value={preText} ph="Например: S, L, XL"
        onChange={(v) => { setPreText(v); set({ preorderSizes: [...new Set(v.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean))] }); }} />}
      {it.preorder && <ANote tone="n" text={`Покупатель увидит эти размеры серыми и сможет оставить заявку${multi ? ' в любой расцветке' : ''}. Распроданные размеры тоже можно заказать${preText.trim() ? '' : '; пока поле пустое — только их'}.`} />}
      {!isNew && <BtnRow items={[
        ...(it.show ? [{ label: 'Снять с продажи', kind: 'danger' as const, dis: busy, on: () => { const next = { ...it, show: false }; setIt(next); save(next, 'Вещь скрыта из каталога'); } }] : []),
        { label: 'Удалить вещь', kind: 'dangerSoft', dis: busy, on: askDelete },
      ]} />}
    </AdminScreen>
  );
}

/** Предложения одной расцветки: касание открывает форму, ± меняют остаток. */
function OfferList({ offers, onEdit, onQty }: { offers: AdmOffer[]; onEdit: (o: AdmOffer) => void; onQty: (o: AdmOffer, qty: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 18, overflow: 'hidden', background: 'var(--lb-ink-a08)', border: '1px solid var(--lb-ink-a08)' }}>
      {offers.map((o) => (
        <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 14px', background: 'var(--lb-white)' }}>
          <button type="button" onClick={() => onEdit(o)} aria-label={'Изменить: ' + o.cond} className="pressable"
            style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, padding: 0, border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--lb-ink)', font: 'inherit' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3 }}>{o.cond}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', borderRadius: 999, background: 'var(--lb-n-150)', fontSize: 11, fontWeight: 700 }}>{o.size}</span>
            </span>
            <span style={{ fontSize: 12, color: o.qty && o.price ? 'var(--lb-ink-2)' : 'var(--lb-danger)', fontWeight: o.qty && o.price ? 500 : 600 }}>{o.price ? rub(o.price) + (o.qty ? '' : ' · нет в наличии') : 'Цена не указана'}</span>
          </button>
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 12, background: 'var(--lb-n-100)' }}>
            <StepBtn aria={'Меньше: ' + o.cond} d="M5 12h14" on={() => onQty(o, Math.max(0, o.qty - 1))} />
            <span style={{ minWidth: 36, textAlign: 'center', fontSize: 13.5, fontWeight: 700 }}>{o.qty}</span>
            <StepBtn aria={'Больше: ' + o.cond} d="M12 5v14M5 12h14" on={() => onQty(o, o.qty + 1)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StepBtn({ aria, d, on }: { aria: string; d: string; on: () => void }) {
  return (
    <button type="button" aria-label={aria} onClick={on} className="pressable-sm"
      style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 10, background: 'transparent', color: 'var(--lb-ink)', cursor: 'pointer' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d={d} /></svg>
    </button>
  );
}

const filterName = (id?: string) => COLORS.find((x) => x.id === id)?.name ?? '';
/** Подпись цвета в редакторе: у своего цвета — в каком цвете фильтра его найдут. */
const colorSub = (c: AdmColor) => (colorFilter(c.name) || !c.filter ? c.name : `${c.name} · в фильтре «${filterName(c.filter)}»`);

/** Выбор цвета расцветки: справочник и свои цвета; «Другой цвет» — новое название и цвет фильтра для него. */
function ColorPick({ opts, cur, taken, on }: { opts: ColorOpt[]; cur: string; taken: string[]; on: (v: ColorOpt) => void }) {
  const sheet = useSheet();
  const free = opts.filter((o) => !taken.some((t) => same(t, o.name)));
  const own = () => sheet.open({ title: 'Другой цвет', text: 'Название увидят покупатели в карточке товара. Цвет фильтра нужен, чтобы вещь находилась в каталоге.', body: <ColorForm taken={taken} on={on} />, btns: [] });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      <RadioList aria="Цвет" items={free.map((o) => ({ label: o.name, sub: colorFilter(o.name) ? undefined : `В фильтре — «${filterName(o.filter)}»`, on_: same(o.name, cur), act: () => { on(o); sheet.close(); } }))} />
      <Btn kind="limeSoft" onClick={own}>Другой цвет</Btn>
    </div>
  );
}

function ColorForm({ taken, on }: { taken: string[]; on: (v: ColorOpt) => void }) {
  const sheet = useSheet();
  const [name, setName] = useState('');
  const [filter, setFilter] = useState('');
  const v = name.trim().replace(/^./, (x) => x.toUpperCase());
  // Название из справочника («чёрный») — сразу его цвет фильтра.
  const known = colorFilter(v);
  const dup = !!v && taken.some((t) => same(t, v));
  const f = known || filter;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      <Field label="Название цвета" value={name} onChange={(x) => setName(x.slice(0, 40))} ph="Например: Оливковый" />
      {dup && <ANote tone="err" text={`Цвет «${v}» уже есть у этой вещи`} />}
      {!known && <>
        <AH title="В фильтре каталога" sub="Покупатель найдёт вещь, выбрав этот цвет в фильтре" />
        <RadioList aria="Цвет фильтра" items={COLORS.map((c) => ({ label: c.name, on_: filter === c.id, act: () => setFilter(c.id) }))} />
      </>}
      <Btn kind="primary" dis={!v || dup || !f} onClick={() => { on({ name: v, filter: f }); sheet.close(); }}>{!v ? 'Введите название' : dup ? 'Такой цвет уже есть' : !f ? 'Выберите цвет фильтра' : 'Готово'}</Btn>
      <Btn kind="ghost" onClick={sheet.close}>Отмена</Btn>
    </div>
  );
}

function Pick({ opts, cur, on }: { opts: string[]; cur: string; on: (v: string) => void }) {
  const sheet = useSheet();
  return <div style={{ marginTop: 14 }}><RadioList aria="Выбор" items={opts.map((o) => ({ label: o, on_: o === cur, act: () => { on(o); sheet.close(); } }))} /></div>;
}

/** Несколько категорий: переключатели, хотя бы одна. Порядок выбора сохраняется — первая остаётся основной. */
function CatPick({ opts, cur, on }: { opts: string[]; cur: string[]; on: (v: string[]) => void }) {
  const sheet = useSheet();
  const [sel, setSel] = useState(cur);
  const tgl = (n: string) => setSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : s.concat([n])));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      <TogList items={opts.map((n) => ({ label: n, on_: sel.includes(n), act: () => tgl(n) }))} />
      <Btn kind="primary" dis={!sel.length} onClick={() => { on(sel); sheet.close(); }}>{sel.length ? 'Готово' : 'Выберите категорию'}</Btn>
      <Btn kind="ghost" onClick={sheet.close}>Отмена</Btn>
    </div>
  );
}

function OfferForm({ o, color, onSave, onDelete }: { o: AdmOffer | null; color: string; onSave: (x: AdmOffer) => void; onDelete?: () => void }) {
  const sheet = useSheet();
  const [cond, setCond] = useState(o?.cond ?? CONDS[0]);
  const [size, setSize] = useState(o?.size ?? '');
  const [price, setPrice] = useState(o?.price ? String(o.price) : '');
  const [qty, setQty] = useState(String(o?.qty ?? 1));
  const p = parseInt(price, 10) || 0;
  const ok = size.trim() && p > 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      <RadioList aria="Состояние" items={CONDS.map((c) => ({ label: c, on_: cond === c, act: () => setCond(c) }))} />
      <Field label="Размер" value={size} onChange={setSize} ph="Например: M или 42" />
      <Field label="Цена" value={price} mode="numeric" suffix="₽" onChange={(v) => setPrice(v.replace(/\D/g, ''))} ph="0" />
      <Field label="Остаток" value={qty} mode="numeric" suffix="шт" onChange={(v) => setQty(v.replace(/\D/g, ''))} ph="0" />
      <Btn kind="primary" dis={!ok} onClick={() => { onSave({ id: o?.id ?? newId('o'), color, cond, size: size.trim(), price: p, qty: parseInt(qty, 10) || 0 }); sheet.close(); }}>{o ? 'Готово' : 'Добавить'}</Btn>
      {onDelete && <Btn kind="danger" onClick={() => { onDelete(); sheet.close(); }}>Удалить предложение</Btn>}
      <Btn kind="ghost" onClick={sheet.close}>Отмена</Btn>
    </div>
  );
}

/** adm16 — баннеры главной и категории каталога. Баннер открывается на редактирование; скрытая категория не видна в каталоге и фильтрах. */
export function AdminBannersScreen() {
  const nav = useNav();
  const sheet = useSheet();
  const banners = useAdmin((s) => s.banners);
  const cats = useAdmin((s) => s.cats);
  const L = useLoad(() => adminLoad.showcase(), []);
  if (!L.ready) return <AdminLoading title="Баннеры и категории" error={L.error} retry={L.reload} />;
  return (
    <AdminScreen title="Баннеры и категории">
      <AH title="Баннеры на главной" sub="Порядок — как в карусели" />
      {banners.length > 0 && <Rows items={banners.map((b, i) => ({ img: b.img, icon: b.img ? undefined : 'image' as const, title: `${i + 1}. ${b.title}`, sub: b.sub, pill: b.on ? 'Показан' : 'Скрыт', tone: b.on ? 'live' as const : 'n' as const, on: () => nav.go('/admin/banner/' + (b.id ?? i)) }))} />}
      <BtnRow items={[{ label: 'Добавить баннер', kind: 'limeSoft', on: () => nav.go('/admin/banner/new') }]} />
      <AH title="Категории" sub="Фото плитки и показ в каталоге. Скрытая категория не видна в каталоге и фильтрах" />
      <Rows items={cats.map((c, i) => ({ img: c.img, icon: c.img ? undefined : 'tag' as const, title: c.name, sub: `${c.n} ${plural(c.n, 'вещь', 'вещи', 'вещей')}`, pill: c.on ? 'Показана' : 'Скрыта', tone: c.on ? 'live' as const : 'n' as const, on: () => nav.go('/admin/category/' + (c.id ?? i)) }))} />
      <BtnRow items={[{ label: 'Добавить категорию', kind: 'limeSoft', on: () => sheet.open({ title: 'Новая категория', body: <AddCategory />, btns: [] }) }]} />
    </AdminScreen>
  );
}

/** Плитка категории в ленте каталога: квадратное фото и показ в каталоге. Фото сохраняется сразу после загрузки. */
export function AdminCategoryScreen() {
  const { id = '' } = useParams();
  const { busy, run } = useAction();
  const cats = useAdmin((s) => s.cats);
  const L = useLoad(() => adminLoad.showcase(), []);
  if (!L.ready) return <AdminLoading title="Категория" error={L.error} retry={L.reload} />;
  const i = cats.findIndex((c, k) => String(c.id ?? k) === id);
  const c = cats[i];
  if (!c) return <AdminScreen title="Категория"><AEmpty icon="tag" title="Категория не найдена" text="Возможно, её удалили. Вернитесь к списку категорий." /></AdminScreen>;
  const pick = (files: File[]) => run(async () => { const url = await adminUploads.categoryPhoto(files[0]); if (url) await adminApi.setCategoryImg(i, url); }, 'Фото категории обновлено');
  return (
    <AdminScreen title={c.name} sub={`${c.n} ${plural(c.n, 'вещь', 'вещи', 'вещей')} · ${c.on ? 'показана в каталоге' : 'скрыта'}`}>
      <PhotoGrid title="Фото плитки" cnt={c.img ? 'Загружено' : 'Своего фото нет'} cntTone={c.img ? 'live' : 'n'} cols={2} accept="image/png,image/jpeg"
        sub="Квадрат 1 : 1, PNG или JPG, от 600 × 600 до 1000 × 1000. Вещь по центру с полями по краям, фон светлый — плитка маленькая и скругляет углы."
        items={c.img ? [{ img: c.img, aria: 'Текущее фото' }, { cap: busy ? 'Загрузка…' : 'Заменить фото', aria: 'Заменить фото' }] : [{ cap: busy ? 'Загрузка…' : 'Загрузить фото', aria: 'Загрузить фото' }]}
        onPick={busy ? undefined : pick} />
      {!c.img && <ANote tone="n" text="Пока своего фото нет, в каталоге показывается стандартная картинка labeled." />}
      <TogList items={[{ label: 'Показывать в каталоге', sub: 'Скрытая категория не видна в каталоге и фильтрах', on_: c.on, act: () => run(() => adminApi.setCategory(i, !c.on), c.on ? 'Категория скрыта' : 'Категория показана') }]} />
    </AdminScreen>
  );
}

const TARGETS: [BannerInput['target'], string][] = [['link', 'Заказ по ссылке'], ['catalog', 'Категория каталога'], ['email', 'Подтверждение почты'], ['invite', 'Пригласить друга']];

/** adm32 — баннер: картинка 1080 × 600 без текста, заголовок, текст кнопки и куда она ведёт. Без картинки, заголовка и кнопки не сохраняется. */
export function AdminBannerScreen() {
  const { id = 'new' } = useParams();
  const L = useLoad(() => adminLoad.showcase(), []);
  if (!L.ready) return <AdminLoading title="Баннер" error={L.error} retry={L.reload} />;
  return <BannerEditor key={id} id={id} />;
}

function BannerEditor({ id }: { id: string }) {
  const nav = useNav();
  const sheet = useSheet();
  const toast = useToast();
  const { busy, run } = useAction();
  const banners = useAdmin((s) => s.banners);
  const cats = useAdmin((s) => s.cats);
  const i = id === 'new' ? -1 : banners.findIndex((b, k) => String(b.id ?? k) === id);
  const src: AdmBanner | undefined = banners[i];
  const isNew = !src;
  const [b, setB] = useState<BannerInput>(() => ({ title: src?.title ?? '', cta: src?.cta ?? '', target: src?.target ?? 'link', cat: src?.cat ?? null, img: src?.img ?? '' }));
  const set = (p: Partial<BannerInput>) => setB((x) => ({ ...x, ...p }));
  const ok = !!b.img && !!b.title.trim() && !!b.cta.trim();
  const catName = cats.find((c) => (c.id ?? c.name) === b.cat)?.name;
  return (
    <AdminScreen title={isNew ? 'Новый баннер' : 'Баннер ' + (i + 1)} sub={isNew ? 'Появится в конце карусели' : src.on ? 'Показан на главной' : 'Скрыт'}
      bar={[{ label: ok ? 'Сохранить' : 'Добавьте картинку, заголовок и кнопку', dis: !ok || busy, on: () => run(() => adminApi.saveBanner(isNew ? null : i, { ...b, title: b.title.trim(), cta: b.cta.trim() }), () => { nav.back(); toast('Баннер сохранён'); }) }]}>
      <PhotoGrid title="Картинка" sub="PNG или JPG, 1080 × 600, текст на картинке не нужен" cnt={b.img ? 'Загружена' : 'Нет картинки'} cntTone={b.img ? 'live' : 'err'} cols={1} ratio="18 / 10" accept="image/png,image/jpeg"
        items={[b.img ? { img: b.img, aria: 'Заменить картинку', on: () => set({ img: '' }) } : { cap: 'Загрузить картинку', aria: 'Загрузить картинку' }]}
        onPick={(files) => run(async () => { const url = await adminUploads.bannerPhoto(files[0]); if (url) set({ img: url }); })} />
      {!isNew && !src.img && <ANote tone="n" text="Этот баннер нарисован дизайнером labeled. Чтобы заменить его своим, загрузите картинку — на главной будет она с вашим заголовком и кнопкой." />}
      <Field label="Заголовок" value={b.title} onChange={(v) => set({ title: v.slice(0, 40) })} ph="До 40 символов" />
      <Field label="Текст кнопки" value={b.cta} onChange={(v) => set({ cta: v.slice(0, 30) })} ph="Например: Оформить заказ" />
      <AH title="Куда ведёт кнопка" />
      <RadioList aria="Куда ведёт кнопка" items={TARGETS.map(([k, label]) => ({ label, on_: b.target === k, act: () => set({ target: k }) }))} />
      {b.target === 'catalog' && <Rows items={[{ icon: 'tag', title: 'Категория', sub: catName ?? 'Весь каталог', on: () => sheet.open({ title: 'Категория', body: <Pick opts={['Весь каталог', ...cats.map((c) => c.name)]} cur={catName ?? 'Весь каталог'} on={(v) => { const c = cats.find((x) => x.name === v); set({ cat: c ? c.id ?? c.name : null }); }} />, btns: [] }) }]} />}
      {!isNew && <TogList items={[{ label: 'Показывать на главной', on_: src.on, act: () => run(() => adminApi.setBanner(i, !src.on), src.on ? 'Баннер скрыт' : 'Баннер показан') }]} />}
      {!isNew && <BtnRow items={[{ label: 'Удалить баннер', kind: 'danger', dis: busy, on: () => run(() => adminApi.deleteBanner(i), () => { nav.back(); toast('Баннер удалён'); }) }]} />}
    </AdminScreen>
  );
}

const SIZE_PILL: Record<AdmSizeReq['state'], [string, 'live' | 'n' | 'wait']> = { wait: ['Ждёт ответа', 'wait'], yes: ['Уведомлён: размер есть', 'live'], no: ['Отклонено', 'n'] };

/** adm31 — заявки на отсутствующий размер. «Размер есть — уведомить» отправляет сообщение бота и ссылку на карточку. */
export function AdminSizesScreen() {
  const nav = useNav();
  const sheet = useSheet();
  const sizes = useAdmin((s) => s.sizes);
  const L = useLoad(() => adminLoad.sizes(), [], { live: true });
  if (!L.ready) return <AdminLoading title="Заявки на размер" error={L.error} retry={L.reload} />;
  const left = sizes.filter((x) => x.state === 'wait').length;
  const open = (x: AdmSizeReq) => sheet.open({
    title: `${x.item} · ${x.size}`, text: `${x.who} ждёт этот размер · заявка ${x.when.toLowerCase()}`,
    body: <SizeAnswer x={x} onItem={() => { sheet.close(); nav.go('/admin/item/' + x.productId); }} />, btns: [],
  });
  return (
    <AdminScreen title="Заявки на размер" sub={left ? `${left} ${plural(left, 'заявка ждёт', 'заявки ждут', 'заявок ждут')} ответа` : 'Все заявки обработаны'}>
      <ANote tone="n" text="Покупатель оставил заявку на размер, которого нет в наличии. Если размер появился, добавьте предложение в карточке вещи и уведомите покупателя." />
      {sizes.length === 0
        ? <AEmpty icon="tag" title="Заявок нет" text="Когда покупатель попросит отсутствующий размер, заявка появится здесь." />
        : <Rows items={sizes.map((x) => ({ img: x.img, title: `${x.item} · ${x.size}`, sub: `${x.who} · ${x.when}`, pill: SIZE_PILL[x.state][0], tone: SIZE_PILL[x.state][1], on: () => open(x) }))} />}
    </AdminScreen>
  );
}

function SizeAnswer({ x, onItem }: { x: AdmSizeReq; onItem: () => void }) {
  const sheet = useSheet();
  const toast = useToast();
  const { busy, run } = useAction();
  const answer = (a: 'yes' | 'no') => run(() => adminApi.answerSize(x.id, a), () => { sheet.close(); toast(a === 'yes' ? 'Покупатель уведомлён' : 'Заявка отклонена'); });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
      {x.state === 'wait' && <Btn kind="primary" dis={busy} onClick={() => answer('yes')}>Размер есть — уведомить</Btn>}
      <Btn kind="limeSoft" onClick={onItem}>Открыть вещь</Btn>
      {x.state === 'wait' && <Btn kind="danger" dis={busy} onClick={() => answer('no')}>Отклонить заявку</Btn>}
      <Btn kind="ghost" onClick={sheet.close}>Закрыть</Btn>
    </div>
  );
}

function AddCategory() {
  const sheet = useSheet();
  const toast = useToast();
  const { busy, run } = useAction();
  const [name, setName] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      <Field label="Название" value={name} onChange={setName} ph="Например: Обувь" />
      <Btn kind="primary" dis={busy || !name.trim()} onClick={() => run(() => adminApi.addCategory(name.trim()), () => { sheet.close(); toast('Категория добавлена'); })}>Добавить</Btn>
      <Btn kind="ghost" onClick={sheet.close}>Отмена</Btn>
    </div>
  );
}
