import { favApi } from '../../api/content';
import { useApi } from '../../lib/useApi';
import { useNav } from '../../nav/useNav';
import { actions, useApp } from '../../store/app';
import { Btns } from '../../ui/Btn';
import { Empty, Skel } from '../../ui/blocks';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { Tag } from '../../ui/Tag';
import { sized } from '../../lib/img';

/** T — избранное. Проданная вещь остаётся с пометкой и ведёт на «Вещь не найдена» (R). */
export function FavScreen() {
  const nav = useNav();
  const favs = useApp((s) => s.favs);
  const q = useApi(() => favApi.list(favs), [favs.join()], 'fav:' + favs.join());
  return (
    <Screen header={<Header title="Избранное" />}>
      {!favs.length ? (
        <Empty minH={600} title="Здесь пусто" text="Сохраняйте вещи кнопкой «В избранное» в карточке товара." btns={[{ label: 'В каталог', kind: 'primary', on: () => nav.root('/') }]} />
      ) : !q.data ? <Skel /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px var(--col-gap)' }}>
            {q.data.map((it) => (
              <button key={it.id} type="button" onClick={() => nav.go('/product/' + it.id)} className="pressable" style={{ display: 'block', width: '100%', padding: 0, border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--lb-ink)' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 5', borderRadius: 'var(--card-r)', overflow: 'hidden', background: 'var(--lb-n-150)' }}>
                  <div role="img" aria-label={it.name} style={{ width: '100%', height: '100%', backgroundImage: `url(${sized(it.img, 480)})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: it.sold ? 'grayscale(1) opacity(.7)' : 'none' }} />
                  <div style={{ position: 'absolute', left: 8, bottom: 8, right: 8 }}>
                    {it.sold ? <Tag cond="продано" onPhoto /> : it.multi ? <Tag cond="service" text="несколько предложений" service onPhoto /> : <Tag cond={it.cond!} onPhoto />}
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 'var(--f-price)', fontWeight: 700, letterSpacing: '-0.02em' }}>{it.priceLabel}</div>
                <div style={{ marginTop: 4, fontSize: 'var(--f-name)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 34 }}>{it.name}</div>
              </button>
            ))}
          </div>
          <Btns items={[{ label: 'Очистить избранное', kind: 'dangerSoft', on: actions.clearFavs }]} />
        </>
      )}
    </Screen>
  );
}
