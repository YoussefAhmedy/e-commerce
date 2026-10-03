import { ProductGridSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-3 h-4 w-40" />
      <div className="mt-10">
        <ProductGridSkeleton />
      </div>
    </div>
  )
}
