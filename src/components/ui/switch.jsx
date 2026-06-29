import * as React from "react"
import { cn } from "../../utils/cn"

const Switch = React.forwardRef(
  ({ className, checked, defaultChecked, onCheckedChange, onChange, ...props }, ref) => {
    const [internalChecked, setInternalChecked] = React.useState(Boolean(defaultChecked))
    const isControlled = checked !== undefined
    const currentChecked = isControlled ? Boolean(checked) : internalChecked

    const handleChange = (event) => {
      const nextChecked = event.target.checked
      if (!isControlled) setInternalChecked(nextChecked)
      onCheckedChange?.(nextChecked)
      onChange?.(event)
    }

    return (
      <label className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center", props.disabled && "cursor-not-allowed opacity-50")}>
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          checked={currentChecked}
          onChange={handleChange}
          className="peer sr-only"
          {...props}
        />
        <span
          className={cn(
            "h-6 w-11 rounded-full border border-gray-200 bg-gray-200 transition-colors peer-checked:border-brand-purple peer-checked:bg-brand-purple peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-brand-purple peer-focus-visible:ring-offset-2",
            className
          )}
        />
        <span className="pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
      </label>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }

