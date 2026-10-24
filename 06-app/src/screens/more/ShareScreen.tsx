import { useParams } from 'react-router-dom';
import { catalogApi } from '../../api/catalog';
import { useApi } from '../../lib/useApi';
import { asset } from '../../mocks/images';
import { toCatalogItem } from '../../domain/catalog';
import { appLink, haptic, shareLink } from '../../telegram/tma';
import { Btns } from '../../ui/Btn';
import { P, Skel } from '../../ui/blocks';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { Tag } from '../../ui/Tag';
import { useToast } from '../../ui/Toast';
import { sized } from '../../lib/img';

/**
 * Картинка для «Поделиться»: фото, логотип, цена, название, тег. Без адреса, телефона и чеков.
 * Рисуется на canvas; сохраняется через системное меню «Поделиться» или загрузкой файла.
 */
async function renderCard(it: { name: string; priceLabel: string; img: string; tag: string }): Promise<Blob | null> {
  const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  try {
    const W = 1080, H = 1620, ph = 1350;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
    const photo = await load(it.img.replace(/w=\d+&h=\d+/, 'w=1080&h=1350'));
    const k = Math.max(W / photo.width, ph / photo.height);
    g.drawImage(photo, (W - photo.width * k) / 2, (ph - photo.height * k) / 2, photo.width * k, photo.height * k);
    const logo = await load(asset('lbld-black.png'));
    g.drawImage(logo, 40, 40, 160, 160 * logo.height / logo.width);
    g.fillStyle = '#111111';
    await document.fonts.load('700 64px Manrope');
    g.font = '700 64px Manrope, sans-serif'; g.fillText(it.priceLabel, 48, ph + 100);
    g.font = '500 44px Manrope, sans-serif'; g.fillText(it.name, 48, ph + 170);
    g.fillStyle = '#E8E8E5'; const tw = g.measureText(it.tag).width + 56;
    g.beginPath(); g.roundRect(48, ph + 200, tw, 56, 28); g.fill();
    g.fillStyle = '#111111'; g.font = '600 32px Manrope, sans-serif'; g.fillText(it.tag, 76, ph + 238);
    return await new Promise((res) => c.toBlob(res, 'image/png'));
  } catch { return null; }
}

/** I — поделиться вещью: предпросмотр картинки, отправка ссылки в Telegram, сохранение картинки. */
export function ShareScreen() {
  const { id = '' } = useParams();
  const toast = useToast();
  const q = useApi(() => catalogApi.product(id), [id], 'product:' + id);
  const it = q.data ? toCatalogItem(q.data) : null;
  const tag = it ? (it.multi ? 'несколько предложений' : it.cond!) : '';
  const url = appLink('item_' + id);

  const save = async () => {
    if (!it) return;
    const blob = await renderCard({ ...it, tag });
    if (!blob) { haptic.error(); return; }
    const file = new File([blob], `labeled-${id}.png`, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }).catch(() => {}); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Картинка сохранена');
  };

  return (
    <Screen header={<Header title="Поделиться" />}>
      <P>Предпросмотр картинки. Адрес, телефон, чеки и другие личные данные на неё не выводятся.</P>
      {!it ? <Skel n={1} /> : (
        <div style={{ padding: 16, borderRadius: 20, background: 'var(--lb-n-150)' }}>
          <div style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--lb-white)', boxShadow: '0 10px 26px -16px var(--lb-ink-a55)' }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 5', background: 'var(--lb-n-150)' }}>
              <div role="img" aria-label={it.name} style={{ width: '100%', height: '100%', backgroundImage: `url(${sized(it.img, 480)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              <div aria-hidden style={{ position: 'absolute', left: 12, top: 12, width: 54, height: 24, backgroundImage: `url(${asset('lbld-black.png')})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat' }} />
            </div>
            <div style={{ padding: '12px 14px 16px' }}>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.025em' }}>{it.priceLabel}</div>
              <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.3 }}>{it.name}</div>
              <div style={{ marginTop: 8 }}><Tag cond={it.multi ? 'service' : it.cond!} text={tag} service={it.multi} /></div>
            </div>
          </div>
        </div>
      )}
      <Btns items={[
        { label: 'Отправить', kind: 'primary', dis: !it, on: () => it && shareLink(url, `${it.name} · ${it.priceLabel}`) },
        { label: 'Сохранить картинку', kind: 'limeSoft', dis: !it, on: save },
      ]} />
    </Screen>
  );
}
