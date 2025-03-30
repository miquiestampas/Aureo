import React from "react";
import { Column } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { 
  ArrowDownIcon, 
  ArrowUpIcon, 
  ArrowUpDown 
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SortableColumnHeaderProps<T> {
  column: Column<T, unknown>;
  title: string;
  className?: string;
}

export function SortableColumnHeader<T>({
  column,
  title,
  className,
}: SortableColumnHeaderProps<T>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 data-[state=open]:bg-accent"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <span>{title}</span>
        {column.getIsSorted() === "desc" ? (
          <ArrowDownIcon className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === "asc" ? (
          <ArrowUpIcon className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    </div>
  );
}