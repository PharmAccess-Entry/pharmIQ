import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string | number;
  onChange: (value: string) => void;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState("");

    // Sync external value changes to display value
    useEffect(() => {
      if (value === "" || value === undefined || value === null) {
        setDisplayValue("");
        return;
      }
      
      // Only format if the display value doesn't match the clean value
      // This prevents the cursor from jumping when typing trailing zeros/decimals
      const cleanDisplayValue = displayValue.replace(/[^\d.]/g, "");
      if (cleanDisplayValue !== String(value)) {
        const parts = String(value).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        setDisplayValue(parts.join('.'));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      // Allow only numbers and a single decimal point
      const cleanValue = rawValue.replace(/[^\d.]/g, "");
      
      // Prevent multiple decimal points
      if ((cleanValue.match(/\./g) || []).length > 1) return;

      // Format for display immediately
      if (cleanValue) {
        const parts = cleanValue.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        setDisplayValue(parts.join('.'));
      } else {
        setDisplayValue("");
      }

      // Send unformatted value to parent
      onChange(cleanValue);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";
