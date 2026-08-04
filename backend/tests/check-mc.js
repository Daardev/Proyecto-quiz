import { pool } from '../src/config/database.js';

const r = await pool.query(
  "SELECT id, language, type, title, correct_option FROM questions WHERE language = 'sql' AND type = 'multiple_choice' AND is_active = true ORDER BY random() LIMIT 3"
);
console.log('Sample MC SQL questions:');
console.table(r.rows);

const c = await pool.query(
  "SELECT COUNT(*) FROM questions WHERE language = 'sql' AND type = 'multiple_choice' AND is_active = true AND correct_option IS NULL"
);
console.log('MC SQL with correct_option NULL:', c.rows[0].count);

await pool.end();