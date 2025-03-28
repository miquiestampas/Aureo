import React from 'react';
import { ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc' | null;

interface SortableColumnHeaderProps {
  label: string;
  field: string;
  sortField: string | null;
  sortDirection: SortDirection;
  onSort: (field: string) => void;
  className?: string;
}

export function SortableColumnHeader({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
  className,
}: SortableColumnHeaderProps) {
  const isActive = sortField === field;
  
  const handleSort = () => {
    onSort(field);
  };
  
  return (
    <Button
      variant="ghost"
      onClick={handleSort}
      className={cn(
        'flex items-center justify-between px-0 hover:bg-transparent',
        isActive && 'font-bold',
        className
      )}
    >
      <span>{label}</span>
      
      {isActive ? (
        sortDirection === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDown className="ml-2 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
}