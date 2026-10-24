// Фото товаров — заглушки Unsplash из прототипа. В продукте придут с бэкенда.
export const U = (id: string, s: number) => `https://images.unsplash.com/photo-${id}?w=${s}&h=${s}&fit=crop&q=68`;
// В Node (сервер, сид базы) import.meta.env нет — тогда ассеты лежат от корня.
const BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
export const asset = (name: string) => `${BASE}assets/${name}`;

export const IMG = {
  teeBlack: U('1583743814966-8936f5b7be1a', 760), teeBlackS: U('1583743814966-8936f5b7be1a', 200),
  teeBlack2: U('1618354691373-d851c5c3a990', 760), teeBlack2S: U('1618354691373-d851c5c3a990', 200),
  teeMilk: U('1554568218-0f1715e72254', 760), teeMilkS: U('1554568218-0f1715e72254', 200),
  teeMilk2: U('1521572163474-6864f9cf17ab', 760),
  teeGrey: U('1576566588028-4147f3842f27', 760), teeGreyS: U('1576566588028-4147f3842f27', 200),
  shirt: U('1596755094514-f87e34085b2c', 620), shirtS: U('1596755094514-f87e34085b2c', 200),
  knit: U('1434389677669-e08b4cac3105', 620), knitS: U('1434389677669-e08b4cac3105', 200),
  bomber: U('1591047139829-d91aecb6caea', 620), bomberS: U('1591047139829-d91aecb6caea', 200),
  chinos: U('1473966968600-fa801b869a1a', 620), chinosS: U('1473966968600-fa801b869a1a', 200),
  bag: U('1553062407-98eeb64c6a62', 620), bagS: U('1553062407-98eeb64c6a62', 200),
  sneak: U('1542291026-7eec264c27ff', 620), sneakS: U('1542291026-7eec264c27ff', 200),
  chart: U('1516762689617-e1cffcef479d', 700),
  ava: U('1494790108377-be9c29b29330', 200),
  receipt: U('1554224155-8d04cb21cd6c', 200),
  catBag: U('1553062407-98eeb64c6a62', 220),
  catAcc: U('1556905055-8f358a7a47b2', 220),
  catJacket: U('1611312449408-fcece27cdbb7', 220),
  catBase: U('1620799140408-edc6dcb6d633', 220),
};
