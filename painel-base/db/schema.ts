import { sqliteTable, text, integer, uniqueIndex, index, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const birds = sqliteTable('birds', {
 id: text('id').primaryKey(), scope: text('scope').notNull(), identification: text('identification').notNull(), name: text('name').notNull().default(''), species: text('species').notNull(), sex: text('sex').notNull(), mutation: text('mutation').notNull(), certainty: text('certainty').notNull().default('observada'), carriers: text('carriers').notNull().default(''), origin: text('origin').notNull(), notes: text('notes').notNull().default(''), birthDate: text('birth_date').notNull().default(''), fatherId: text('father_id').references((): AnySQLiteColumn => birds.id), motherId: text('mother_id').references((): AnySQLiteColumn => birds.id), createdAt: text('created_at').notNull(),
}, t => [uniqueIndex('birds_scope_identification').on(t.scope, t.identification), index('birds_scope').on(t.scope)]);
export const pairs = sqliteTable('pairs', {
 id: text('id').primaryKey(), scope: text('scope').notNull(), name: text('name').notNull(), maleId: text('male_id').notNull().references(() => birds.id), femaleId: text('female_id').notNull().references(() => birds.id), startDate: text('start_date').notNull(), endDate: text('end_date'), notes: text('notes').notNull().default(''),
}, t => [uniqueIndex('pairs_active_male').on(t.maleId).where(sql`${t.endDate} IS NULL`), uniqueIndex('pairs_active_female').on(t.femaleId).where(sql`${t.endDate} IS NULL`), index('pairs_scope').on(t.scope)]);
export const clutches = sqliteTable('clutches', {
 id: text('id').primaryKey(), scope: text('scope').notNull(), pairId: text('pair_id').notNull().references(() => pairs.id), startDate: text('start_date').notNull(), endDate: text('end_date'), notes: text('notes').notNull().default(''),
}, t => [index('clutches_scope').on(t.scope), uniqueIndex('clutches_open_pair').on(t.pairId).where(sql`${t.endDate} IS NULL`)]);
export const eggs = sqliteTable('eggs', {
 id: text('id').primaryKey(), scope: text('scope').notNull(), clutchId: text('clutch_id').notNull().references(() => clutches.id), number: integer('number').notNull(), laidDate: text('laid_date').notNull(), status: text('status').notNull(), hatchDate: text('hatch_date'), chickId: text('chick_id').references(() => birds.id), notes: text('notes').notNull().default(''),
}, t => [index('eggs_scope').on(t.scope), uniqueIndex('eggs_clutch_number').on(t.clutchId, t.number), uniqueIndex('eggs_chick').on(t.chickId)]);
export const mutationHistory = sqliteTable('mutation_history', {
 id: text('id').primaryKey(), scope: text('scope').notNull(), birdId: text('bird_id').notNull().references(() => birds.id), mutation: text('mutation').notNull(), certainty: text('certainty').notNull(), carriers: text('carriers').notNull(), recordedAt: text('recorded_at').notNull(),
}, t => [index('mutation_history_scope').on(t.scope)]);
export const demoInit = sqliteTable('demo_init', { id: integer('id').primaryKey() });
