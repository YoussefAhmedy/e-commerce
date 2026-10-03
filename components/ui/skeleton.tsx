import { cn } from '@/lib/utils/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-xl', className)} />
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  )
}
