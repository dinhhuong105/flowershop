import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="shell pb-12 pt-6">
      <Skeleton className="h-9 w-40" />
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <Skeleton className="h-[152px] w-full" />
          <Skeleton className="mt-4 h-[152px] w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
