import { useToastActions } from "@/hooks/use-toast";

interface MutationToastError {
  message: string;
}

type ToastMessage = string | { title: string; description: string };

interface MutationToastOptions<TData, TVariables, TContext> {
  success?:
    ToastMessage | ((data: TData, variables: TVariables) => ToastMessage);
  error?:
    | ToastMessage
    | ((error: MutationToastError, variables: TVariables) => ToastMessage);
  onSuccess?: (
    data: TData,
    variables: TVariables,
    context: TContext,
  ) => unknown;
  onError?: (
    error: MutationToastError,
    variables: TVariables,
    context: TContext,
  ) => unknown;
}

function showToast(
  show: (description: string, title?: string) => void,
  message: ToastMessage | undefined,
) {
  if (!message) return;
  if (typeof message === "string") show(message);
  else show(message.description, message.title);
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
      showToast(
        toast.success,
        typeof success === "function" ? success(data, variables) : success,
      );
      return onSuccess?.(data, variables, context);
    },
    onError: (
      err: MutationToastError,
      variables: TVariables,
      context: TContext,
    ) => {
      showToast(
        toast.error,
        typeof error === "function"
          ? error(err, variables)
          : (error ?? err.message),
      );
      return onError?.(err, variables, context);
    },
  };
}
