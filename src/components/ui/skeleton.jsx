import * as React from "react"
import { cn } from "../../utils/cn"

const Skeleton = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn("animate-pulse rounded-md bg-gray-100", className)}
    {...props}
  />
))
Skeleton.displayName = "Skeleton"

export { Skeleton }

