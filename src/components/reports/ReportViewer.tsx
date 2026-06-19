import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, Printer, FileSpreadsheet } from "lucide-react";
import { ReportConfig, exportToCSV, exportToExcel, exportToPDF } from "@/lib/reports/export";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface ReportViewerProps<T> {
  config: ReportConfig<T>;
  onPrint?: () => void;
}

export function ReportViewer<T>({ config, onPrint }: ReportViewerProps<T>) {
  const { title, subtitle, columns, data } = config;

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    window.print();
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-xl font-bold leading-tight">{title}</CardTitle>
          {subtitle && <p className="text-sm text-muted-foreground mt-1 break-words">{subtitle}</p>}
        </div>
        <div className="flex gap-2 no-print shrink-0">
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportToPDF(config)}>
                <FileText className="h-4 w-4 mr-2" /> PDF Document
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel(config)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel Workbook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToCSV(config)}>
                <FileText className="h-4 w-4 mr-2" /> CSV File
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto print:border-none print:shadow-none">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col, idx) => (
                  <TableHead key={idx} className="whitespace-nowrap">
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-6 text-muted-foreground">
                    No data available for this report.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, rowIdx) => (
                  <TableRow key={rowIdx}>
                    {columns.map((col, colIdx) => {
                      let cellContent = "";
                      if (col.cell) {
                        cellContent = String(col.cell(row));
                      } else if (col.accessorKey) {
                        cellContent = String((row as any)[col.accessorKey] ?? "");
                      }
                      return (
                        <TableCell key={colIdx}>
                          {cellContent}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
