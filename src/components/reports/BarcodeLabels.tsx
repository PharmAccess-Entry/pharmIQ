import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export interface BarcodeLabelProps {
  barcode: string;
  name: string;
  price: number;
}

export function BarcodeLabel({ barcode, name, price }: BarcodeLabelProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && barcode) {
      try {
        JsBarcode(svgRef.current, barcode, {
          format: "CODE128",
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 12,
          margin: 0,
        });
      } catch (err) {
        console.error("Invalid barcode format", barcode);
      }
    }
  }, [barcode]);

  return (
    <div className="w-48 h-24 border border-dashed border-gray-300 p-2 flex flex-col items-center justify-between bg-white overflow-hidden">
      <div className="text-[10px] font-bold text-center truncate w-full leading-tight">{name}</div>
      <div className="flex-1 flex items-center justify-center w-full my-1">
        <svg ref={svgRef} className="max-w-full h-full" />
      </div>
      <div className="text-[11px] font-bold">₦{price.toLocaleString()}</div>
    </div>
  );
}

export function PrintBarcodeLabels({ items }: { items: BarcodeLabelProps[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 print:gap-1 p-4 print:p-0">
      {items.map((item, idx) => (
        <BarcodeLabel key={`${item.barcode}-${idx}`} {...item} />
      ))}
    </div>
  );
}
