import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

export interface RouteValidation {
  params?: ZodSchema;
  query?: ZodSchema;
  body?: ZodSchema;
}

export interface ValidatedData<
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown,
> {
  params: TParams;
  query: TQuery;
  body: TBody;
}

export function validate(schemas: RouteValidation) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validated: ValidatedData = {
        params: schemas.params
          ? await schemas.params.parseAsync(req.params)
          : {},
        query: schemas.query ? await schemas.query.parseAsync(req.query) : {},
        body: schemas.body ? await schemas.body.parseAsync(req.body) : {},
      };

      res.locals.validated = validated;

      next();
    } catch (error) {
      next(error);
    }
  };
}

type MergeValidated<T> = {
  params: T extends { params: infer P } ? P : unknown;
  query: T extends { query: infer Q } ? Q : unknown;
  body: T extends { body: infer B } ? B : unknown;
};

export function getValidated<T extends Partial<ValidatedData>>(
  res: Response,
): MergeValidated<T> {
  return res.locals.validated as MergeValidated<T>;
}
