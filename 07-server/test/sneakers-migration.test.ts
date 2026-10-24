import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { asc, sql } from 'drizzle-orm';
import { openDb } from '../src/db/client';
import { categories } from '../src/db/schema';
import { testApp } from './helpers';

// Миграции 0005–0006: категория после «Штанов» в рабочей базе, где категории созданы раньше без неё; затем «Кроссовки» → «Обувь».
const SQL = readFileSync(new URL('../drizzle/0005_sneakers_category.sql', import.meta.url), 'utf8');
const SHOES = readFileSync(new URL('../drizzle/0006_shoes_category.sql', import.meta.url), 'utf8');
const OLD = [['tee', 'Футболки'], ['top', 'Верх'], ['pants', 'Штаны'], ['bags', 'Сумки'], ['acc', 'Аксессуары'], ['outer', 'Куртки'], ['under', 'Нижнее бельё']];

describe('категория «Обувь»', () => {
  test('рабочая база с 7 категориями: появляется 4-й, порядок сохранён; повтор ничего не меняет', async () => {
    const { db, close } = await openDb({});
    await db.insert(categories).values(OLD.map(([id, name], i) => ({ id, name, sort: i })));
    await db.execute(sql.raw(SQL));
    await db.execute(sql.raw(SQL));
    const rows = await db.select().from(categories).orderBy(asc(categories.sort));
    assert.deepEqual(rows.map((r) => r.name), ['Футболки', 'Верх', 'Штаны', 'Кроссовки', 'Сумки', 'Аксессуары', 'Куртки', 'Нижнее бельё']);
    await db.execute(sql.raw(SHOES));
    const after = await db.select().from(categories).orderBy(asc(categories.sort));
    assert.deepEqual([after[3].id, after[3].name], ['sneakers', 'Обувь']);
    await close();
  });
  test('свежая база: seed даёт «Обувь» один раз, и она видна покупателю', async () => {
    const t = await testApp();
    const show = (await t.app.inject({ method: 'GET', url: '/api/showcase' })).json() as { categories: { id: string; name: string }[] };
    assert.equal(show.categories.filter((c) => c.name === 'Обувь').length, 1);
    assert.equal(show.categories.filter((c) => c.name === 'Кроссовки').length, 0);
    assert.equal(show.categories[3].id, 'sneakers');
    await t.close();
  });
});
