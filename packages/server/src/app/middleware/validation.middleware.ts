import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

/**
 * Validation schemas for a route
 */
export interface RouteValidation {
  params?: ZodSchema;
  query?: ZodSchema;
  body?: ZodSchema;
}

/**
 * Validated request data stored in res.locals
 */
export interface ValidatedData<
  TParams = unknown,
  TQuery = unknown,
  TBody = unknown,
> {
  params: TParams;
  query: TQuery;
  body: TBody;
}

/**
 * Creates validation middleware that validates request data and stores the parsed result in res.locals
 *
 * @param schemas - Zod schemas to validate against for params, query, and/or body
 * @returns Express middleware that validates the request and calls next, or forwards a ZodError on failure
 *
 * @example
 * router.get(
 *   '/:id',
 *   validate({
 *     params: GetPlayerParamsSchema,
 *     query: GetPlayerQuerySchema
 *   }),
 *   PlayerController.getPlayer
 * );
 *
 * // In controller - only specify what you validated!
 * const { params, query } = getValidated<{
 *   params: GetPlayerParams;
 *   query: GetPlayerQuery;
 * }>(res);
 */
export function validate(schemas: RouteValidation) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Parse all schemas, defaulting to empty objects
      const validated: ValidatedData = {
        params: schemas.params
          ? await schemas.params.parseAsync(req.params)
          : {},
        query: schemas.query ? await schemas.query.parseAsync(req.query) : {},
        body: schemas.body ? await schemas.body.parseAsync(req.body) : {},
      };

      // Store in res.locals (standard Express pattern)
      res.locals.validated = validated;

      next();
    } catch (error) {
      // Zod errors are caught by error handler
      next(error);
    }
  };
}

/**
 * Merge validated types properly, overriding 'any' defaults
 * when specific types are provided
 */
type MergeValidated<T> = {
  params: T extends { params: infer P } ? P : unknown;
  query: T extends { query: infer Q } ? Q : unknown;
  body: T extends { body: infer B } ? B : unknown;
};

/**
 * Helper to retrieve typed validated data from res.locals, only specify the parts you actually validated
 *
 * @param res - Express response whose locals contain the validated data
 * @returns Typed object with params, query, and body shaped by the provided generic
 *
 * @example
 * // Only params
 * const { params } = getValidated<{ params: GetPlayerParams }>(res);
 *
 * @example
 * // Params and query
 * const { params, query } = getValidated<{
 *   params: GetPlayerParams;
 *   query: GetPlayersQuery;
 * }>(res);
 *
 * @example
 * // All three
 * const { params, query, body } = getValidated<{
 *   params: GetPlayerParams;
 *   query: GetPlayersQuery;
 *   body: CreatePlayerBody;
 * }>(res);
 */
export function getValidated<T extends Partial<ValidatedData>>(
  res: Response,
): MergeValidated<T> {
  return res.locals.validated as MergeValidated<T>;
}
