import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

/** 打开数据库：PRAGMA + 自动迁移（docs/05 §1）。 */
export function openDb(file: string): { db: Db; sqlite: Database.Database } {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return { db, sqlite };
}

// 开发模式热更新会重复执行模块，连接挂在 globalThis 上复用
const g = globalThis as unknown as { __atomsDb?: { db: Db; sqlite: Database.Database } };

export function getDb(): Db {
  if (!g.__atomsDb) g.__atomsDb = openDb(process.env.DATABASE_PATH || "./data/app.db");
  return g.__atomsDb.db;
}

/** 仅测试使用：替换为指定的数据库（例如 :memory:）。 */
export function setDbForTests(file: string): Db {
  g.__atomsDb?.sqlite.close();
  g.__atomsDb = openDb(file);
  return g.__atomsDb.db;
}
