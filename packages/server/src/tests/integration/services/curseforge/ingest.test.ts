import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  afterAll,
  vi,
} from "vitest";

vi.mock("@/services/curseforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/curseforge")>();
  return {
    ...actual,
    getMod: vi.fn(),
    getMods: vi.fn(async () => []),
  };
});

import pool, { Q } from "@/db";
import {
  classEnvironmentHint,
  CurseForgeClass,
  deriveEnvironmentHint,
  getMod,
  getMods,
} from "@/services/curseforge";
import {
  ingestProject,
  ingestProjects,
  refreshProjects,
} from "@/services/curseforge/ingest";
import { makeProjectData } from "@/tests/helpers/workshop";

const projectIds: number[] = [];
let nextProjectId = 993_000_000;

function claimProjectId(): number {
  const id = nextProjectId++;
  projectIds.push(id);
  return id;
}

async function seedRow(id: number): Promise<void> {
  await Q.curseforge.project.create({
    id,
    classId: 6,
    slug: `vitest-ingest-${id}`,
    name: `Vitest Ingest ${id}`,
  });
}

beforeAll(async () => {
  await pool.query("SELECT 1");
});

afterEach(async () => {
  if (projectIds.length > 0) {
    await Q.curseforge.project.deleteAll({ id: { $in: projectIds } });
    projectIds.length = 0;
  }
  vi.clearAllMocks();
});

afterAll(async () => {
  await pool.end();
});

describe("deriveEnvironmentHint", () => {
  it("reads the Client and Server tags out of gameVersions", () => {
    expect(
      deriveEnvironmentHint([
        { gameVersions: ["1.21.1", "Client", "NeoForge"] },
      ]),
    ).toBe("client");
    expect(deriveEnvironmentHint([{ gameVersions: ["Server"] }])).toBe(
      "server",
    );
    expect(
      deriveEnvironmentHint([{ gameVersions: ["Client", "Server"] }]),
    ).toBe("both");
  });

  it("unions tags across files", () => {
    expect(
      deriveEnvironmentHint([
        { gameVersions: ["1.21.1", "Client"] },
        { gameVersions: ["1.21.1", "Server"] },
      ]),
    ).toBe("both");
  });

  it("returns null when no file carries a tag", () => {
    expect(deriveEnvironmentHint([])).toBeNull();
    expect(
      deriveEnvironmentHint([{ gameVersions: ["1.21.1", "NeoForge"] }]),
    ).toBeNull();
    expect(deriveEnvironmentHint([{ gameVersions: null }])).toBeNull();
  });
});

describe("classEnvironmentHint", () => {
  it("pins shaders and resource packs to the client", () => {
    expect(classEnvironmentHint(CurseForgeClass.shaders)).toBe("client");
    expect(classEnvironmentHint(CurseForgeClass.resourcePacks)).toBe("client");
  });

  it("has no opinion on mods and data packs", () => {
    expect(classEnvironmentHint(CurseForgeClass.mods)).toBeNull();
    expect(classEnvironmentHint(CurseForgeClass.dataPacks)).toBeNull();
  });
});

describe("environment hints on ingest", () => {
  it("classifies shaders client-side from their class, ahead of file tags", async () => {
    const shaderId = claimProjectId();
    const packId = claimProjectId();
    vi.mocked(getMods).mockResolvedValue([
      makeProjectData(shaderId, { classId: CurseForgeClass.shaders }),
      makeProjectData(packId, {
        classId: CurseForgeClass.resourcePacks,
        environmentHint: "server",
      }),
    ]);

    await ingestProjects([shaderId, packId]);

    for (const id of [shaderId, packId]) {
      expect(await Q.curseforge.project.get({ id })).toMatchObject({
        environment: "client",
        environmentSource: "cf_flag",
      });
    }
  });

  it("reclassifies an existing unspecified row by class on refresh", async () => {
    const projectId = claimProjectId();
    await seedRow(projectId);
    vi.mocked(getMods).mockResolvedValue([
      makeProjectData(projectId, { classId: CurseForgeClass.shaders }),
    ]);

    await refreshProjects([projectId]);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      classId: CurseForgeClass.shaders,
      environment: "client",
      environmentSource: "cf_flag",
    });
  });

  it("stores a CurseForge hint when a project is first ingested", async () => {
    const projectId = claimProjectId();
    vi.mocked(getMods).mockResolvedValue([
      makeProjectData(projectId, { environmentHint: "client" }),
    ]);

    await ingestProjects([projectId]);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "client",
      environmentSource: "cf_flag",
    });
  });

  it("leaves projects without a hint unspecified", async () => {
    const projectId = claimProjectId();
    vi.mocked(getMods).mockResolvedValue([makeProjectData(projectId)]);

    await ingestProjects([projectId]);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "unspecified",
      environmentSource: null,
    });
  });

  it("applies a hint to an existing unclassified row on refresh", async () => {
    const projectId = claimProjectId();
    await seedRow(projectId);
    vi.mocked(getMods).mockResolvedValue([
      makeProjectData(projectId, { environmentHint: "server" }),
    ]);

    await refreshProjects([projectId]);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "server",
      environmentSource: "cf_flag",
    });
  });

  it("never overwrites a manual flag with a CurseForge hint", async () => {
    const projectId = claimProjectId();
    await seedRow(projectId);
    await Q.curseforge.project.update(
      { id: projectId },
      { environment: "client", environmentSource: "manual" },
    );
    vi.mocked(getMods).mockResolvedValue([
      makeProjectData(projectId, { environmentHint: "both" }),
    ]);

    await refreshProjects([projectId]);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "client",
      environmentSource: "manual",
    });
  });

  it("never overwrites a manifest-confirmed environment with a CurseForge hint", async () => {
    const projectId = claimProjectId();
    await seedRow(projectId);
    await Q.curseforge.project.update(
      { id: projectId },
      { environment: "both", environmentSource: "manifest" },
    );
    vi.mocked(getMods).mockResolvedValue([
      makeProjectData(projectId, { environmentHint: "client" }),
    ]);

    await refreshProjects([projectId]);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "both",
      environmentSource: "manifest",
    });
  });

  it("follows a changed CurseForge flag on later refreshes", async () => {
    const projectId = claimProjectId();
    vi.mocked(getMods).mockResolvedValue([
      makeProjectData(projectId, { environmentHint: "client" }),
    ]);
    await ingestProjects([projectId]);

    vi.mocked(getMods).mockResolvedValue([
      makeProjectData(projectId, { environmentHint: "server" }),
    ]);
    await refreshProjects([projectId]);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "server",
      environmentSource: "cf_flag",
    });
  });

  it("applies hints through the single-project ingest as well", async () => {
    const projectId = claimProjectId();
    await seedRow(projectId);
    vi.mocked(getMod).mockResolvedValue(
      makeProjectData(projectId, { environmentHint: "both" }),
    );

    await ingestProject(projectId);

    expect(await Q.curseforge.project.get({ id: projectId })).toMatchObject({
      environment: "both",
      environmentSource: "cf_flag",
    });
  });
});
