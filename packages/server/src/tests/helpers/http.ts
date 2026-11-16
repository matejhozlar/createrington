import type { Request, Response } from "express";
import { vi, type Mock } from "vitest";

export type FakeRes = Response & {
  json: Mock;
  send: Mock;
  status: Mock;
  type: Mock;
  setHeader: Mock;
};

export function fakeReq(fields: Record<string, unknown> = {}): Request {
  return { headers: {}, cookies: {}, ...fields } as unknown as Request;
}

export function fakeRes(locals: Record<string, unknown> = {}): FakeRes {
  const res = {
    locals,
    json: vi.fn(),
    send: vi.fn(),
    status: vi.fn(),
    type: vi.fn(),
    setHeader: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.type.mockReturnValue(res);
  return res as unknown as FakeRes;
}
