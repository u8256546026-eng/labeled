import { Bell, CircleCheck, CreditCard, Gift, Heart, LogOut, Mail, MapPin, MessageCircleQuestion, Package, Receipt, Send, SlidersHorizontal, Star, Tag, Trash2, Truck, FileText, ShieldCheck, Calculator, Link2 } from 'lucide-react';
import type { ReactNode } from 'react';

/** Иконки разделов с подложкой по смыслу (IC в Buyer v15). */
const IC = {
  orders: [Package, 'var(--lb-lime-soft)', 'var(--lb-ink)'],
  addr: [MapPin, 'var(--lb-warn-soft)', 'var(--lb-warn-ink)'],
  gift: [Gift, 'var(--lb-violet-soft)', 'var(--lb-violet)'],
  star: [Star, 'var(--lb-ink-2)', 'var(--lime)'],
  help: [MessageCircleQuestion, 'var(--lb-n-150)', 'var(--lb-ink)'],
  bell: [Bell, 'var(--lb-lime-soft)', 'var(--lb-ink)'],
  heart: [Heart, 'var(--lb-danger-soft)', 'var(--lb-danger)'],
  receipt: [Receipt, 'var(--lb-n-150)', 'var(--lb-ink)'],
  mail: [Mail, 'var(--lb-lime-soft)', 'var(--lb-ink)'],
  logout: [LogOut, 'var(--lb-n-150)', 'var(--lb-ink)'],
  trash: [Trash2, 'var(--lb-danger-soft)', 'var(--lb-danger)'],
  send: [Send, 'var(--lb-ink-2)', 'var(--lime)'],
  truck: [Truck, 'var(--lb-lime-soft)', 'var(--lb-ink)'],
  card: [CreditCard, 'var(--lb-warn-soft)', 'var(--lb-warn-ink)'],
  check: [CircleCheck, 'var(--lb-lime-soft)', 'var(--lb-ink)'],
  tag: [Tag, 'var(--lb-danger-soft)', 'var(--lb-danger)'],
  gear: [SlidersHorizontal, 'var(--lb-n-150)', 'var(--lb-ink)'],
  doc: [FileText, 'var(--lb-n-150)', 'var(--lb-ink)'],
  shield: [ShieldCheck, 'var(--lb-violet-soft)', 'var(--lb-violet)'],
  calc: [Calculator, 'var(--lb-warn-soft)', 'var(--lb-warn-ink)'],
  link: [Link2, 'var(--lb-lime-soft)', 'var(--lb-ink)'],
} as const;

export type IconName = keyof typeof IC;

export function ic(name: IconName): { icon: ReactNode; iconBg: string; iconFg: string } {
  const [I, bg, fg] = IC[name];
  return { icon: <I size={20} strokeWidth={2} />, iconBg: bg, iconFg: fg };
}
