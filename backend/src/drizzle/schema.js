import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  json,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 30 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull().default(''),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  language: varchar('language', { length: 20 }).notNull().default('javascript'),
  type: varchar('type', { length: 20 }).notNull().default('code'),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  starterCode: text('starter_code'),
  setupCode: text('setup_code'),
  testsTemplate: json('tests_template'),
  options: json('options'),
  correctOption: integer('correct_option'),
  solution: text('solution'),
  solutions: json('solutions'),
  isActive: boolean('is_active').notNull().default(true),
  hash: varchar('hash', { length: 32 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const quizzes = pgTable('quizzes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  language: varchar('language', { length: 20 }).notNull().default('javascript'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  attemptsLeft: integer('attempts_left').notNull().default(5),
});

export const quizQuestions = pgTable('quiz_questions', {
  id: serial('id').primaryKey(),
  quizId: integer('quiz_id')
    .notNull()
    .references(() => quizzes.id),
  questionId: integer('question_id')
    .notNull()
    .references(() => questions.id),
  order: integer('order').notNull(),
  attemptsCount: integer('attempts_count').notNull().default(0),
});

export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  quizQuestionId: integer('quiz_question_id')
    .notNull()
    .references(() => quizQuestions.id),
  code: text('code').notNull(),
  sandboxResults: json('sandbox_results'),
  score: integer('score'),
  evaluatedAt: timestamp('evaluated_at'),
  kind: varchar('kind', { length: 20 }).notNull().default('answer'),
});

export const session = pgTable('session', {
  sid: varchar('sid').primaryKey(),
  sess: json('sess').notNull(),
  expire: timestamp('expire').notNull(),
});
