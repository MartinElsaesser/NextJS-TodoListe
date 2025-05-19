import * as fs from "fs";
import { pool } from "../db";

// loads DDL statements from schema.sql file
// and runs them on the database

void (async function connectToDbAndUploadSchema() {
  const client = await pool.connect();

  const sql = fs.readFileSync(__dirname + "/schema.sql", "utf8");

  await client.query(sql);
  await client.release();
  await pool.end();

  console.info("Initialized Database Schema");
})();
