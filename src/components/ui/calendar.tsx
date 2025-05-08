"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { format, isSameDay } from "date-fns"

import { cn } from "~/lib/utils"
import { buttonVariants } from "~/components/ui/button"

interface CalendarProps {
  selected?: Date
  onSelect?: (date: Date | null) => void
  disabled?: boolean
  className?: string
  showOutsideDays?: boolean
  mode?: "single" | "range" | "multiple"
  initialFocus?: boolean
  classNames?: Record<string, string>
}

function Calendar({
  selected,
  onSelect,
  disabled = false,
  className,
  classNames,
  ...props
}: CalendarProps) {
  return (
    <div className={cn("p-3", className)}>
      <DatePicker
        selected={selected}
        onChange={onSelect}
        disabled={disabled}
        inline
        calendarClassName="bg-transparent"
        dayClassName={(date) => {
          const isSelected = selected && isSameDay(date, selected);
          const isTodayExact = isSameDay(date, new Date());
          return cn(
            buttonVariants({ variant: "ghost" }),
            "size-8 p-0 font-normal aria-selected:opacity-100",
            "[&.react-datepicker__day--today:not(.react-datepicker__day--selected)]:bg-transparent",
            "[&.react-datepicker__day--today:not(.react-datepicker__day--selected)]:border-none",
            "[&.react-datepicker__day--today:not(.react-datepicker__day--selected)]:font-normal",
            isSelected
              ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground"
              : "",
            isTodayExact && !isSelected
              ? "bg-accent text-accent-foreground"
              : ""
          );
        }}
        renderCustomHeader={({
          date,
          decreaseMonth,
          increaseMonth,
          prevMonthButtonDisabled,
          nextMonthButtonDisabled,
        }) => (
          <div className="flex justify-center pt-1 relative items-center w-full">
            <button
              onClick={decreaseMonth}
              disabled={prevMonthButtonDisabled}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "absolute left-1 size-7 bg-transparent p-0 opacity-50 hover:opacity-100"
              )}
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-medium">
              {format(date, "MMMM yyyy")}
            </span>
            <button
              onClick={increaseMonth}
              disabled={nextMonthButtonDisabled}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "absolute right-1 size-7 bg-transparent p-0 opacity-50 hover:opacity-100"
              )}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
        {...props}
      />
    </div>
  )
}

export { Calendar }
