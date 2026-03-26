import type { Pool, PoolClient } from "pg";
import { StructurePackBaseQueries } from "@/generated/db/structure_pack.queries";
import type {
  StructurePack,
  StructurePackRow,
  StructurePackMod,
} from "@createrington/shared/db";

export type StructurePackWithMods = StructurePack & {
  mods: StructurePackMod[];
};

type PackRowWithMods = StructurePackRow & { mods: StructurePackMod[] };

const MODS_AGG = `
  COALESCE(
    json_agg(
      json_build_object(
        'id', m.id,
        'packId', m.pack_id,
        'curseforgeModId', m.curseforge_mod_id,
        'curseforgeFileId', m.curseforge_file_id,
        'fileName', m.file_name,
        'modName', m.mod_name,
        'modUrl', m.mod_url,
        'thumbnailUrl', m.thumbnail_url,
        'createdAt', m.created_at
      )
    ) FILTER (WHERE m.id IS NOT NULL),
    '[]'
  ) AS mods`;

export class StructurePackQueries extends StructurePackBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  async findAllWithMods(): Promise<StructurePackWithMods[]> {
    const result = await this.db.query<PackRowWithMods>(
      `SELECT p.*, ${MODS_AGG}
      FROM structure_pack p
      LEFT JOIN structure_pack_mod m ON m.pack_id = p.id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id
      ORDER BY p.created_at DESC`,
    );
    return result.rows.map((row) => ({
      ...this.mapRowToEntity(row),
      mods: row.mods,
    }));
  }

  async findOneWithMods(id: number): Promise<StructurePackWithMods | null> {
    const result = await this.db.query<PackRowWithMods>(
      `SELECT p.*, ${MODS_AGG}
      FROM structure_pack p
      LEFT JOIN structure_pack_mod m ON m.pack_id = p.id
      WHERE p.id = $1 AND p.deleted_at IS NULL
      GROUP BY p.id`,
      [id],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...this.mapRowToEntity(row),
      mods: row.mods,
    } as StructurePackWithMods;
  }

  async getActive(): Promise<StructurePackWithMods | null> {
    const result = await this.db.query<PackRowWithMods>(
      `SELECT p.*, ${MODS_AGG}
      FROM structure_pack p
      LEFT JOIN structure_pack_mod m ON m.pack_id = p.id
      WHERE p.is_active = true AND p.deleted_at IS NULL
      GROUP BY p.id
      LIMIT 1`,
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...this.mapRowToEntity(row),
      mods: row.mods,
    } as StructurePackWithMods;
  }

  async getEligibleForRotation(
    excludePackId?: number,
  ): Promise<StructurePack[]> {
    const params: unknown[] = [];
    let excludeClause = "";
    if (excludePackId != null) {
      params.push(excludePackId);
      excludeClause = `AND p.id != $${params.length}`;
    }
    const result = await this.db.query<StructurePackRow>(
      `SELECT p.*
      FROM structure_pack p
      LEFT JOIN structure_pack_mod m ON m.pack_id = p.id
      WHERE p.enabled = true
        AND p.deleted_at IS NULL
        ${excludeClause}
      GROUP BY p.id
      HAVING COUNT(m.id) > 0
      ORDER BY p.last_activated_at ASC NULLS FIRST`,
      params,
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }
}
