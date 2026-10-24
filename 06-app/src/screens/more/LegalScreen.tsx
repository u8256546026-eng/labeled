import { useParams } from 'react-router-dom';
import { legalApi } from '../../api/content';
import { FAQ } from '../../mocks/content';
import { useApi } from '../../lib/useApi';
import { useNav } from '../../nav/useNav';
import { Cards, Empty, H, P, Skel } from '../../ui/blocks';
import { ic } from '../../ui/icons';
import { Header } from '../../ui/Header';
import { Screen } from '../../ui/Screen';
import { useSheet } from '../../ui/Sheet';

/** AV — документы. Дата «Действуют с …» и список приходят из API; тексты пока заглушки. */
export function LegalScreen() {
  const nav = useNav();
  const sheet = useSheet();
  const q = useApi(() => legalApi.index(), [], 'legal');
  const terms = () => sheet.open({ title: FAQ.terms.title, text: FAQ.terms.text, btns: [{ label: 'Понятно', kind: 'ghost' }] });
  return (
    <Screen header={<Header title="Документы" sub={q.data ? 'Действуют с ' + q.data.effectiveFrom : undefined} />}>
      {!q.data ? <Skel n={2} /> : (
        <>
          <Cards rows={q.data.docs.map((d) => ({ ...ic(d.id === 'offer' ? 'doc' : 'shield'), title: d.title, sub: d.sub, pill: 'Обязательно', pillTone: 'live' as const, on: () => nav.go('/legal/' + d.id) }))} />
          <H text="Условия" />
          <Cards rows={[
            { ...ic('calc'), title: 'Условия услуг', sub: 'Фотоотчёт, коробка, защита 1%', on: terms },
            { ...ic('link'), title: 'Заказы из-за границы', sub: 'Выкупаются под вас, вернуть нельзя', on: terms },
          ]} />
          <P>Вы приняли оферту и политику при первом входе. Новые версии пришлём в Telegram.</P>
        </>
      )}
    </Screen>
  );
}

/** Текст документа. Пока заглушка — текст предоставляет заказчик. */
export function LegalDocScreen() {
  const { id = '' } = useParams();
  const nav = useNav();
  const q = useApi(() => legalApi.doc(id), [id], 'legal:' + id);
  if (q.data === null) return <Screen header={<Header title="Документы" />}><Empty minH={560} title="Документ не найден" text="Откройте его из раздела «Документы»." btns={[{ label: 'Документы', kind: 'primary', on: nav.back }]} /></Screen>;
  return (
    <Screen header={<Header title={q.data?.title ?? 'Документ'} sub={q.data ? 'Действуют с ' + q.data.effectiveFrom : undefined} />}>
      {!q.data ? <Skel n={2} /> : q.data.body.map((t, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.55, textWrap: 'pretty' }}>{t}</div>)}
    </Screen>
  );
}
