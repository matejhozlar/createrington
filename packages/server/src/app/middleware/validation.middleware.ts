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
 * This is more explicit and debuggable than magic req properties
 */
export interface ValidatedData<TParams = any, TQuery = any, TBody = any> {
  params: TParams;
  query: TQuery;
  body: TBody;
}

/**
 * Creates validation middleware that validates and stores parsed data in res.locals
 *
 * Benefits over your current approach:
 * - Explicit typing (no magic properties)
 * - Standard Express pattern (res.locals)
 * - Better autocomplete
 * - Easier to debug
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
 * // In controller:
 * const { params, query } = res.locals.validated;
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
 * Type helper for controllers to get validated data with proper types
 *
 * @example
 * type Validated = ValidatedRequest<
 *   typeof GetPlayerParamsSchema,
 *   typeof GetPlayerQuerySchema
 * >;
 *
 * const { params, query } = getValidated<Validated>(res);
 */
export type ValidatedRequest<
  TParamsSchema extends ZodSchema = ZodSchema,
  TQuerySchema extends ZodSchema = ZodSchema,
  TBodySchema extends ZodSchema = ZodSchema,
> = ValidatedData<
  TParamsSchema extends ZodSchema ? ReturnType<TParamsSchema["parse"]> : never,
  TQuerySchema extends ZodSchema ? ReturnType<TQuerySchema["parse"]> : never,
  TBodySchema extends ZodSchema ? ReturnType<TBodySchema["parse"]> : never
>;

/**
 * Helper to get typed validated data from res.locals
 */
export function getValidated<T extends ValidatedData>(res: Response): T {
  return res.locals.validated as T;
}
