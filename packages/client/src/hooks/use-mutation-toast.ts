import { useToastActions } from "@/hooks/use-toast";

interface MutationToastError {
  message: string;
}

interface MutationToastOptions<TData, TVariables> {
  success?: string | ((data: TData, variables: TVariables) => string);
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: MutationToastError) => void;
}

export function useMutationToast<TData = unknown, TVariables = unknown>(
  options: MutationToastOptions<TData, TVariables> = {},
) {
  const toast = useToastActions();
  const { success, onSuccess, onError } = options;

  return {
    onSuccess: (data: TData, variables: TVariables) => {
      if (success !== undefined) {
        toast.success(
          typeof success === "function" ? success(data, variables) : success,
        );
      }
      onSuccess?.(data, variables);
    },
    onError: (error: MutationToastError) => {
      toast.error(error.message);
      onError?.(error);
    },
  };
}
