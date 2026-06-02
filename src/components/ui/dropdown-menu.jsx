import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Check } from "lucide-react"
import { cn } from "../../utils/cn"

const DropdownMenu = React.forwardRef(({ ...props }, ref) => (
  <PopoverPrimitive.Root {...props} />
))
DropdownMenu.displayName = "DropdownMenu"

const DropdownMenuTrigger = PopoverPrimitive.Trigger

const DropdownMenuContent = React.forwardRef(({ className, align = "start", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Content
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-gray-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
))
DropdownMenuContent.displayName = "DropdownMenuContent"

const DropdownMenuLabel = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = "DropdownMenuLabel"

const DropdownMenuSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("-mx-1 my-1 h-px bg-gray-100", className)} {...props} />
))
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

const DropdownMenuCheckboxItem = React.forwardRef(
  ({ className, checked, onCheckedChange, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-gray-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span className={cn("absolute left-2 flex h-3.5 w-3.5 items-center justify-center", checked ? "opacity-100" : "opacity-0")}>
        <Check className="h-4 w-4" />
      </span>
      <span className="pl-8">{children}</span>
    </div>
  )
)
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
}
