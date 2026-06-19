import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface CustomDatePickerProps {
  value: string; // Expected format: YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function CustomDatePicker({ value, onChange, className, placeholder = "Select date" }: CustomDatePickerProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const date = value ? new Date(value) : undefined;

  useEffect(() => {
    if (value) {
      // Create a date in local time from the YYYY-MM-DD string
      const [y, m, d] = value.split("-").map(Number);
      if (y && m && d) {
        setInputValue(format(new Date(y, m - 1, d), "MMM d, yyyy"));
      } else {
        setInputValue(value);
      }
    } else {
      setInputValue("");
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      onChange("");
      return;
    }
    const parsed = new Date(inputValue);
    if (!isNaN(parsed.getTime())) {
      onChange(format(parsed, "yyyy-MM-dd"));
    } else {
      // Revert if invalid
      if (value) {
        const [y, m, d] = value.split("-").map(Number);
        if (y && m && d) setInputValue(format(new Date(y, m - 1, d), "MMM d, yyyy"));
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleInputBlur();
      setIsOpen(false);
    }
  };

  const handleSelect = (d: Date | undefined) => {
    if (d) {
      onChange(format(d, "yyyy-MM-dd"));
      setIsOpen(false);
    } else {
      onChange("");
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none z-10" />
          <Input
            className={cn("font-normal cursor-text bg-card border-border", !value && "text-muted-foreground", className, "pl-8")}
            placeholder={placeholder}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
