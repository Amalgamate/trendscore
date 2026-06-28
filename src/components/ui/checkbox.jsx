import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "../../utils/cn"

const Checkbox = React.forwardRef(
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
      <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center align-middle">
        <input
          ref={ref}
          type="checkbox"
          checked={currentChecked}
          onChange={handleChange}
          className={cn(
            "peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-gray-300 bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 checked:border-brand-purple checked:bg-brand-purple",
            className
          )}
          {...props}
        />
        <Check className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
      </span>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }

