import pg from "pg";
import config from "@/config";
import { GuildMemberJoinQueries } from "./queries/discord/guild-member-join/queries";

/**
 * PostgreSQL database pool instance using environment variables
 *
 * Environment variables used:
 * @env DB_USER - The PostgreSQL username
 * @env DB_HOST - The PostgreSQL host
 * @env DB_DATABASE - The name of the database
 * @env DB_PASSWORD - The database user's password
 * @env DB_PORT - The port PostgreSQL is running on
 */
const db = new pg.Pool(config.database.pool);

async () => {
  try {
    await db.query("SELECT 1");
    logger.info("Connected to PostgreSQL database");
  } catch (error) {
    logger.error("Failed to connect to DB:", error);
    process.exit(1);
  }
};

export const guildMemberJoins = new GuildMemberJoinQueries(db);

export default db;
