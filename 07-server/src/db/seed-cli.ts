import { loadConfig } from '../config';
import { openDb } from './client';
import { seedDemo } from './seed';

const config = loadConfig();
const { db, close } = await openDb({ url: config.databaseUrl, pgliteDir: config.pgliteDir });
console.log((await seedDemo(db)) ? 'Демо-данные загружены' : 'В базе уже есть данные — посев пропущен');
await close();
