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
 * Creates a validation middleware that validates request data against Zod schemas
 *
 * Automatically validates and attaches parsed data to req.validatedParams, req.validatedQuery, req.validatedBody
 * Throws ZodError on validation failure, which is caught by the error handler
 *
 * @param schemas - Object containing Zod schemas for params, query, and/or body
 * @returns Express middleware function
 *
 * @example
 * router.get(
 *   '/:id',
 *   validate({ params: GetPlayerParamsSchema, query: GetPlayerQuerySchema }),
 *   PlayerController.getPlayer
 * );
 */
export function validate(schemas: RouteValidation) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (schemas.params) {
        req.validatedParams = await schemas.params.parseAsync(req.params);
      }
      if (schemas.query) {
        req.validatedQuery = await schemas.query.parseAsync(req.query);
      }
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Shorthand validation functions for common scenarios
 */
export const validateParams = (schema: ZodSchema) =>
  validate({ params: schema });
export const validateQuery = (schema: ZodSchema) => validate({ query: schema });
export const validateBody = (schema: ZodSchema) => validate({ body: schema });
