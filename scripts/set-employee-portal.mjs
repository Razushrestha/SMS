import "dotenv/config";
import pg from "pg";
import { randomBytes, scryptSync } from "crypto";

const username = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3];
if (!username || !password) {
  console.error("Usage: node scripts/set-employee-portal.mjs <username> <password>");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const list = await client.query("select id, name, portal_username from employees order by name limit 5");
console.log(JSON.stringify(list.rows.map((row) => ({ id: row.id, name: row.name, user: row.portal_username }))));
if (!list.rows[0]) {
  await client.end();
  process.exit(1);
}
const id = list.rows[0].id;
await client.query("update employees set portal_username = $1, portal_password_hash = $2 where id = $3", [username, hash, id]);
const check = await client.query("select name, portal_username, portal_password_hash is not null as has_hash from employees where id = $1", [id]);
console.log(JSON.stringify(check.rows[0]));
await client.end();
