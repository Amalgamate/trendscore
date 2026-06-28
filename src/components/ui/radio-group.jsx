import * as React from "react"
import { cn } from "../../utils/cn"

const RadioGroupContext = React.createContext(null)

const RadioGroup = React.forwardRef(
  ({ className, value, defaultValue, onValueChange, name, disabled, children, ...props }, ref) => {
    const generatedName = React.useId()
    const groupName = name || generatedName
    const [internalValue, setInternalValue] = React.useState(defaultValue ?? "")
    const isControlled = value !== undefined
    const currentValue = isControlled ? value : internalValue

    const setValue = React.useCallback((nextValue) => {
      if (!isControlled) setInternalValue(nextValue)
      onValueChange?.(nextValue)
    }, [isControlled, onValueChange])

    const contextValue = React.useMemo(() => ({
      name: groupName,
      value: currentValue,
      setValue,
      disabled,
    }), [groupName, currentValue, setValue, disabled])

    return (
      <RadioGroupContext.Provider value={contextValue}>
        <div ref={ref} role="radiogroup" className={cn("grid gap-2", className)} {...props}>
          {children}
        </div>
      </RadioGroupContext.Provider>
    )
  }
)
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef(
  ({ className, value, disabled, onChange, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext)
    if (!context) {
      throw new Error("RadioGroupItem must be used within RadioGroup")
    }

    const isDisabled = disabled || context.disabled
    const checked = context.value === value

    const handleChange = (event) => {
      if (event.target.checked) context.setValue(value)
      onChange?.(event)
    }

    return (
      <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center align-middle">
        <input
          ref={ref}
          type="radio"
          name={context.name}
          value={value}
          checked={checked}
          disabled={isDisabled}
          onChange={handleChange}
          className={cn(
            "peer h-5 w-5 cursor-pointer appearance-none rounded-full border-2 border-gray-300 bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 checked:border-brand-purple",
            className
          )}
          {...props}
        />
        <span className="pointer-events-none absolute h-2.5 w-2.5 rounded-full bg-brand-purple opacity-0 transition-opacity peer-checked:opacity-100" />
      </span>
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }

