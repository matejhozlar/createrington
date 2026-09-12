import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/page-header";
import { Paginator } from "@/components/paginator";
import { NotFound } from "@/pages/not-found";
import { LoadingScreen } from "@/components/loading-spinner";
import { GalleryTile } from "./components/GalleryTile";
import { GalleryLightbox } from "./components/GalleryLightbox";
import { GalleryGridSkeleton } from "./components/GalleryGridSkeleton";
import { GalleryEmpty } from "./components/GalleryEmpty";
import { GALLERY_PAGE_SIZE } from "./types";

export function Gallery() {
  const [page, setPage] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const enabledQuery = trpc.public.gallery.isEnabled.useQuery();
  const enabled = enabledQuery.data?.enabled ?? false;

  const listQuery = trpc.public.gallery.list.useQuery(
    { page, limit: GALLERY_PAGE_SIZE },
    { enabled },
  );

  if (enabledQuery.isLoading) {
    return <LoadingScreen text="Loading gallery..." />;
  }

  if (!enabled) {
    return <NotFound />;
  }

  const items = listQuery.data?.items ?? [];
  const pagination = listQuery.data?.pagination;

  const changePage = (next: number) => {
    setPage(next);
    setLightboxIndex(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <PageHeader
        title="Gallery"
        description="Builds, views and moments captured by the players of Createrington."
        imageSrc="/assets/hero/metro.webp"
      />

      <section className="px-5 pb-16 md:px-8 md:py-16">
        <div className="mx-auto max-w-7xl space-y-8">
          {listQuery.isPending ? (
            <GalleryGridSkeleton />
          ) : listQuery.isError ? (
            <p className="text-destructive">
              Failed to load the gallery. Please try again later.
            </p>
          ) : items.length === 0 ? (
            <GalleryEmpty />
          ) : (
            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
              {items.map((item, index) => (
                <GalleryTile
                  key={item.id}
                  item={item}
                  onOpen={() => setLightboxIndex(index)}
                />
              ))}
            </div>
          )}

          {pagination && items.length > 0 ? (
            <Paginator
              page={pagination.page}
              limit={pagination.limit}
              total={pagination.total}
              totalPages={pagination.totalPages}
              onPageChange={changePage}
              itemLabel="screenshot"
            />
          ) : null}
        </div>
      </section>

      <GalleryLightbox
        items={items}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}
