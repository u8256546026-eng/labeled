import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { reviewsApi } from '../../api/afterSale';
import { useOrders } from '../../api/useOrders';
import { copyText } from '../../lib/clipboard';
import { useNav } from '../../nav/useNav';
import { actions, useApp } from '../../store/app';
import { haptic, openExternal } from '../../telegram/tma';
import { Chips, H, Note, Skel, Tog } from '../../ui/blocks';
import { Input, Items, Upload } from '../../ui/commerce';
import { Header } from '../../ui/Header';
import { Stars } from '../../ui/orderBlocks';
import { Screen } from '../../ui/Screen';
import { useToast } from '../../ui/Toast';

/** AB — отзыв о покупке: оценка, текст, фото, подпись, дубль на Яндекс Картах. Отзыв проходит модерацию (adm20). */
export function ReviewScreen() {
  const { num = '' } = useParams();
  const [sp] = useSearchParams();
  const nav = useNav();
  const toast = useToast();
  const { orders } = useOrders();
  const name = useApp((s) => s.name);
  const sent = useApp((s) => s.reviewsSent[num]);
  const [stars, setStars] = useState(() => Number(sp.get('stars')) || 0);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [sign, setSign] = useState<'short' | 'anon'>('short');
  const [ya, setYa] = useState(false);
  const [busy, setBusy] = useState(false);
  const o = orders?.find((x) => x.num === num);
  const item = o?.items?.[0];
  const short = (() => { const [a, b] = name.split(' '); return b ? `${a} ${b.charAt(0)}.` : a; })();
  const yaUrl = import.meta.env.VITE_YANDEX_MAPS_URL;

  const submit = () => {
    setBusy(true);
    reviewsApi.submit({ orderNum: num, stars, text, photo, sign, files }).then(async () => {
      actions.reviewSent(num); haptic.success();
      if (ya && text) { await copyText(text); toast('Скопировано'); }
    }, () => setBusy(false));
  };

  if (!orders) return <Screen header={<Header title="Отзыв о покупке" />}><Skel n={2} /></Screen>;
  if (sent) {
    return (
      <Screen header={<Header title="Отзыв о покупке" sub={`Заказ ${num}`} />} bar={{ btns: [{ label: 'Все отзывы', kind: 'ghost', on: () => nav.go('/reviews') }, { label: 'К заказу', kind: 'primary', on: () => nav.goOrBack('/order/' + num) }] }}>
        <Note tone="ok" title="Отзыв на модерации" text="После проверки он появится в «Отзывах о labeled» с отметкой «Покупка подтверждена»." />
        {ya && <Note tone="info" title="Яндекс Карты" text="Текст отзыва скопирован. Вставьте его в карточке labeled на Яндекс Картах — там отзыв публикуете вы, от своего аккаунта." act={yaUrl ? { label: 'Открыть Яндекс Карты', on: () => openExternal(yaUrl) } : undefined} />}
      </Screen>
    );
  }
  return (
    <Screen header={<Header title="Отзыв о покупке" sub={`Заказ ${num} · ${o?.kind === 'stock' ? 'из наличия' : 'по ссылке'}`} />}
      bar={{ btns: [{ label: stars ? 'Отправить отзыв' : 'Поставьте оценку', kind: 'primary', dis: !stars || busy, on: submit }] }}>
      {item && <Items rows={[{ key: 'i', name: item.name, params: item.params, price: item.price, img: item.img, tag: item.tag }]} />}
      <H text="Оценка" />
      <Stars value={stars} onPick={setStars} />
      <H text="Отзыв" sub="Что понравилось, что нет, совпал ли размер" />
      <Input label="Текст отзыва" value={text} max={600} ph="Например: размер совпал, ткань плотная" onChange={(v) => setText(v.slice(0, 600))} />
      <H text="Фото" sub="По желанию, до 5 снимков" />
      <Upload accept="image/*" max={5} title="Добавить фото" text="Вещь на вас или детали" file={photo ? { name: '1 фото', meta: 'Добавлено только что' } : null} onPick={(_f, all) => { setPhoto(true); setFiles(all); }} onClear={() => { setPhoto(false); setFiles([]); }} />
      <H text="Подпись" />
      <Chips label="Подпись" rows={[{ label: short, on_: sign === 'short', act: () => setSign('short') }, { label: 'Покупатель labeled', on_: sign === 'anon', act: () => setSign('anon') }]} />
      <Tog rows={[{ label: 'Продублировать на Яндекс Картах', sub: 'Скопируем текст и откроем карточку labeled. Там отзыв публикуете вы сами, поэтому он остаётся независимым.', on_: ya, act: () => setYa(!ya) }]} />
      <Note tone="info" title="Как публикуются отзывы" text="Модератор проверяет каждый отзыв: низкие оценки публикуются так же, как высокие. Скрываем только оскорбления и личные данные." />
    </Screen>
  );
}
