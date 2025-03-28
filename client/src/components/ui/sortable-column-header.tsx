import { Column } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}

export function SortableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: SortableColumnHeaderProps<TData, TValue>) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      className={cn("text-sm font-medium", className)}
    >
      {title}
      {column.getIsSorted() === "asc" ? (
        <ArrowUpIcon className="ml-2 h-4 w-4" />
      ) : column.getIsSorted() === "desc" ? (
        <ArrowDownIcon className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
}