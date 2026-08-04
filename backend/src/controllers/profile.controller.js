import { eq, sql, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { quizzes, quizQuestions, submissions } from '../drizzle/schema.js';

export async function getUserQuizzes(userId) {
  const rows = await db.select().from(quizzes).where(eq(quizzes.userId, userId)).orderBy(desc(quizzes.startedAt));
  const result = [];
  for (const quiz of rows) {
    const totalScore = await db.execute(sql`
      SELECT COALESCE(SUM(s.score), 0)::int AS total_score
      FROM quiz_questions qq
      LEFT JOIN submissions s ON s.quiz_question_id = qq.id
      WHERE qq.quiz_id = ${quiz.id}
    `);
    result.push({
      id: quiz.id,
      language: quiz.language,
      startedAt: quiz.startedAt,
      completedAt: quiz.completedAt,
      score: totalScore.rows[0]?.total_score || 0,
    });
  }
  return result;
}

export async function getUserStats(userId) {
  const completed = await db.execute(sql`SELECT COUNT(*)::int AS c FROM quizzes WHERE user_id = ${userId} AND completed_at IS NOT NULL`);
  const abandoned = await db.execute(sql`SELECT COUNT(*)::int AS c FROM quizzes WHERE user_id = ${userId} AND completed_at IS NULL`);
  const scores = await db.execute(sql`
    SELECT COALESCE(SUM(s.score), 0)::int AS total_score, COALESCE(MAX(s.score), 0)::int AS best_score
    FROM quizzes q
    LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
    LEFT JOIN submissions s ON s.quiz_question_id = qq.id
    WHERE q.user_id = ${userId}
  `);
  return {
    totalCompleted: completed.rows[0]?.c || 0,
    totalAbandoned: abandoned.rows[0]?.c || 0,
    totalScore: scores.rows[0]?.total_score || 0,
    bestScore: scores.rows[0]?.best_score || 0,
  };
}
