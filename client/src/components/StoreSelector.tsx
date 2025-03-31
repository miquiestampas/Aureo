import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'

interface Store {
  id: number;
  code: string;
  name: string;
  type: string;
  district?: string | null;
  locality?: string | null;
  active: boolean;
}

interface StoreSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function StoreSelector({
  value,
  onChange,
  placeholder = "Seleccionar tienda",
  className,
  disabled = false
}: StoreSelectorProps) {
  // Fetch stores
  const { data: stores, isLoading, error } = useQuery<Store[]>({
    queryKey: ['/api/stores'],
  });

  // Transform stores data to combobox options
  const storeOptions: ComboboxOption[] = React.useMemo(() => {
    if (!stores) return [];
    
    return stores
      .filter(store => store.active) // Solo tiendas activas
      .sort((a, b) => a.name.localeCompare(b.name)) // Ordenar por nombre
      .map(store => ({
        value: store.id.toString(),
        label: `${store.name} (${store.code})`
      }));
  }, [stores]);

  // Handle loading state
  if (isLoading) {
    return (
      <Combobox
        options={[]}
        value=""
        onChange={() => {}}
        placeholder="Cargando tiendas..."
        disabled={true}
        className={className}
      />
    );
  }

  // Handle error state
  if (error) {
    return (
      <Combobox
        options={[]}
        value=""
        onChange={() => {}}
        placeholder="Error al cargar tiendas"
        disabled={true}
        className={className}
      />
    );
  }

  return (
    <Combobox
      options={storeOptions}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      emptyMessage="No se encontraron tiendas"
      className={className}
      disabled={disabled}
    />
  );
}