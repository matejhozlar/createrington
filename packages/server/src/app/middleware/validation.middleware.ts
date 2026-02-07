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
export interface ValidatedData<TParams = any, TQuery = any, TBody = any> {
  params: TParams;
  query: TQuery;
  body: TBody;
}

/**
 * Creates validation middleware that validates and stores parsed data in res.locals
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
 * Helper to get typed validated data from res.locals
 * Only specify the parts you actually validated!
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
): ValidatedData & T {
  return res.locals.validated as ValidatedData & T;
}
