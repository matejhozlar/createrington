import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { GALLERY_PAGE_SIZE, type GalleryItem } from "../format";

export type LightboxDirection = -1 | 1;

interface GalleryPagination {
  total: number;
  totalPages: number;
}

interface UseGalleryLightboxOptions {
  items: GalleryItem[];
  page: number;
  pagination: GalleryPagination | undefined;
  onPageChange: (page: number) => void;
}

function listInput(page: number) {
  return { page, limit: GALLERY_PAGE_SIZE };
}

export function useGalleryLightbox({
  items,
  page,
  pagination,
  onPageChange,
}: UseGalleryLightboxOptions) {
  const utils = trpc.useUtils();
  const toast = useToastActions();
  const [index, setIndex] = useState<number | null>(null);
  const [turning, setTurning] = useState<LightboxDirection | null>(null);
  const requestRef = useRef(0);

  const totalPages = pagination?.totalPages ?? 0;
  const total = pagination?.total ?? items.length;
  const isOpen = index !== null;
  const item = index === null ? null : (items[index] ?? null);

  const hasPrevious = isOpen && (index > 0 || page > 0);
  const hasNext = isOpen && (index < items.length - 1 || page < totalPages - 1);

  useEffect(() => {
    if (index === null) return;
    if (index === items.length - 1 && page < totalPages - 1) {
      void utils.public.gallery.list.prefetch(listInput(page + 1));
    }
    if (index === 0 && page > 0) {
      void utils.public.gallery.list.prefetch(listInput(page - 1));
    }
  }, [index, items.length, page, totalPages, utils]);

  const open = (next: number) => {
    requestRef.current += 1;
    setTurning(null);
    setIndex(next);
  };

  const close = () => {
    requestRef.current += 1;
    setTurning(null);
    setIndex(null);
  };

  const step = async (direction: LightboxDirection) => {
    if (index === null || turning !== null) return;

    const next = index + direction;
    if (next >= 0 && next < items.length) {
      setIndex(next);
      return;
    }

    const targetPage = page + direction;
    if (targetPage < 0 || targetPage >= totalPages) return;

    const request = ++requestRef.current;
    setTurning(direction);
    try {
      const data = await utils.public.gallery.list.fetch(listInput(targetPage));
      if (request !== requestRef.current) return;
      if (data.items.length === 0) {
        await utils.public.gallery.list.invalidate();
        return;
      }
      onPageChange(targetPage);
      setIndex(direction > 0 ? 0 : data.items.length - 1);
    } catch {
      if (request !== requestRef.current) return;
      toast.error(
        direction > 0
          ? "Could not load the next page of screenshots."
          : "Could not load the previous page of screenshots.",
      );
    } finally {
      if (request === requestRef.current) setTurning(null);
    }
  };

  return {
    item,
    position: page * GALLERY_PAGE_SIZE + (index ?? 0) + 1,
    total,
    hasPrevious,
    hasNext,
    turning,
    open,
    close,
    step,
  };
}
