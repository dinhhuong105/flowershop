// Khung xương (skeleton) shimmer cho loading.tsx — kích thước đúng với
// nội dung thật để không gây CLS (mục 3.3 phụ lục).

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-shimmer rounded-[3px] ${className}`} />;
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="aspect-[4/5] w-full" />
      <Skeleton className="mt-3 h-4 w-1/3" />
      <Skeleton className="mt-2 h-5 w-full" />
      <Skeleton className="mt-2 h-5 w-2/3" />
      <Skeleton className="mt-2 h-6 w-1/2" />
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <>
      <div className="h-[440px] w-full bg-green-900 md:h-[520px]">
        <div className="shell flex h-full flex-col justify-center gap-4">
          <Skeleton className="h-4 w-56 bg-white/20" />
          <Skeleton className="h-12 w-full max-w-xl bg-white/20" />
          <Skeleton className="h-6 w-full max-w-md bg-white/20" />
          <Skeleton className="h-11 w-44 bg-white/20" />
        </div>
      </div>
      <div className="shell py-10">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </>
  );
}

export function CategoryPageSkeleton() {
  return (
    <>
      <div className="bg-green-900">
        <div className="shell flex flex-col gap-4 py-10 sm:py-12">
          <Skeleton className="h-4 w-48 bg-white/20" />
          <Skeleton className="h-10 w-72 bg-white/20" />
          <Skeleton className="h-5 w-full max-w-xl bg-white/20" />
        </div>
      </div>
      <div className="shell pb-12 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-11 w-56" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </>
  );
}
