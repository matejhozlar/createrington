import { describe, it, expect, vi } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("@/db", () => ({}));

import { AppError, NotFoundError } from "@/errors";
import { NotFoundError as DbNotFoundError } from "@/db/utils/errors";
import {
  findOrThrow,
  paginateQuery,
  mapDomainError,
  sortDirection,
} from "@/trpc/utils";

describe("sortDirection", () => {
  it("accepts asc and desc", () => {
    expect(sortDirection().parse("asc")).toBe("asc");
    expect(sortDirection().parse("desc")).toBe("desc");
  });

  it("carries no default of its own", () => {
    expect(sortDirection().safeParse(undefined).success).toBe(false);
  });
});

describe("findOrThrow", () => {
  it("returns the row when the lookup resolves to one", async () => {
    const row = { id: 1 };
    await expect(findOrThrow(Promise.resolve(row), "missing")).resolves.toBe(
      row,
    );
  });

  it.each([null, undefined])(
    "throws NOT_FOUND with the given message when the lookup resolves to %s",
    async (value) => {
      const err: unknown = await findOrThrow(
        Promise.resolve(value),
        "Thing not found",
      ).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("NOT_FOUND");
      expect((err as TRPCError).message).toBe("Thing not found");
    },
  );
});

describe("paginateQuery", () => {
  type Row = { id: number };

  function fakeSource(rows: Row[], total: number) {
    return {
      findAll: vi.fn<(filters: object, options: object) => Promise<Row[]>>(
        async () => rows,
      ),
      count: vi.fn<(filters: object) => Promise<number>>(async () => total),
    };
  }

  it("feeds the same filter object to the page query and the count", async () => {
    const source = fakeSource([{ id: 1 }], 41);
    const filters = { name: { $ilike: "%a%" } };

    await paginateQuery(source, filters, { page: 2, limit: 20 });

    expect(source.findAll.mock.calls[0][0]).toBe(filters);
    expect(source.count.mock.calls[0][0]).toBe(filters);
  });

  it("leaves the order keys off the options when no order is given", async () => {
    const source = fakeSource([], 0);

    await paginateQuery(source, {}, { page: 2, limit: 20 });

    const [, options] = source.findAll.mock.calls[0];
    expect(options).toEqual({ limit: 20, offset: 40 });
    expect(options).not.toHaveProperty("orderBy");
    expect(options).not.toHaveProperty("orderDirection");
  });

  it("turns page and limit into limit and offset and forwards the order", async () => {
    const source = fakeSource([], 0);

    await paginateQuery(
      source,
      {},
      { page: 3, limit: 25 },
      { orderBy: "id", orderDirection: "desc" },
    );

    expect(source.findAll).toHaveBeenCalledWith(
      {},
      { limit: 25, offset: 75, orderBy: "id", orderDirection: "desc" },
    );
  });

  it("forwards a multi-column order unchanged", async () => {
    const source = fakeSource([], 0);
    const orderBy = [
      { field: "id", direction: "desc" },
      { field: "id" },
    ] as const;

    await paginateQuery(source, {}, { page: 0, limit: 10 }, { orderBy });

    expect(source.findAll).toHaveBeenCalledWith(
      {},
      { limit: 10, offset: 0, orderBy },
    );
  });

  it("returns the rows with the pagination metadata", async () => {
    const rows = [{ id: 7 }, { id: 8 }];
    const source = fakeSource(rows, 41);

    await expect(
      paginateQuery(source, {}, { page: 2, limit: 20 }),
    ).resolves.toEqual({
      rows,
      pagination: { page: 2, limit: 20, total: 41, totalPages: 3 },
    });
  });
});

describe("mapDomainError", () => {
  const wrapped = (cause: Error) =>
    new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause });

  it("maps an AppError to the code of its status", () => {
    const cause = new AppError("CurseForge is holding this server off", 503);

    expect(mapDomainError(wrapped(cause))).toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "CurseForge is holding this server off",
      cause,
    });
  });

  it("maps an AppError NotFoundError to NOT_FOUND", () => {
    expect(
      mapDomainError(wrapped(new NotFoundError("Player not found"))),
    ).toMatchObject({ code: "NOT_FOUND", message: "Player not found" });
  });

  it("maps a missing database row to NOT_FOUND", () => {
    const cause = new DbNotFoundError("Player", { id: 7 });

    expect(mapDomainError(wrapped(cause))).toMatchObject({
      code: "NOT_FOUND",
      message: cause.message,
    });
  });

  it("leaves an AppError without a client status as an internal error", () => {
    expect(mapDomainError(wrapped(new AppError("broken", 500)))).toBeNull();
  });

  it("leaves an unknown error as an internal error", () => {
    expect(mapDomainError(wrapped(new Error("boom")))).toBeNull();
  });

  it("leaves a TRPCError a procedure threw on purpose alone", () => {
    const error = new TRPCError({
      code: "CONFLICT",
      cause: new AppError("ignored", 404),
    });

    expect(mapDomainError(error)).toBeNull();
  });
});
