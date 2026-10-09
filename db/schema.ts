import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const photographs=sqliteTable('photographs',{
 id:text('id').primaryKey(),title:text('title').notNull(),titleEn:text('title_en').notNull().default(''),descriptionEn:text('description_en').notNull().default(''),locationEn:text('location_en').notNull().default(''),category:text('category').notNull(),description:text('description').notNull().default(''),location:text('location').notNull().default(''),takenAt:text('taken_at').notNull().default(''),
 originalKey:text('original_key').notNull(),thumbnailKey:text('thumbnail_key').notNull(),largeKey:text('large_key').notNull(),contentType:text('content_type').notNull(),width:integer('width').notNull(),height:integer('height').notNull(),bytes:integer('bytes').notNull(),
 published:integer('published').notNull().default(0),position:integer('position').notNull().default(0),version:integer('version').notNull().default(1),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},table=>[index('idx_photographs_published_position').on(table.published,table.position)]);
export const settings=sqliteTable('settings',{key:text('key').primaryKey(),value:text('value').notNull()});
