import { useToastActions } from "@/hooks/use-toast";

interface MutationToastError {
  message: string;
}

interface MutationToastOptions<TData, TVariables, TContext> {
  success?: string | ((data: TData, variables: TVariables) => string);
  error?:
    string | ((error: MutationToastError, variables: TVariables) => string);
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void;
  onError?: (
    error: MutationToastError,
    variables: TVariables,
    context: TContext,
  ) => void;
}

export function useMutationToast<
  TData = unknown,
  TVariables = unknown,
  TContext = unknown,
>(options: MutationToastOptions<TData, TVariables, TContext> = {}) {
  const toast = useToastActions();
  const { success, error, onSuccess, onError } = options;

  return {
    onSuccess: (data: TData, variables: TVariables, context: TContext) => {
      const message =
        typeof success === "function" ? success(data, variables) : success;
      if (message) toast.success(message);
      onSuccess?.(data, variables, context);
    },
    onError: (
      err: MutationToastError,
      variables: TVariables,
      context: TContext,
    ) => {
      const message =
        typeof error === "function"
          ? error(err, variables)
          : (error ?? err.message);
      if (message) toast.error(message);
      onError?.(err, variables, context);
    },
  };
}
