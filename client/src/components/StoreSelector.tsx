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
  storeType?: 'PDF' | 'Excel' | null;
}

export function StoreSelector({
  value,
  onChange,
  placeholder = "Seleccionar tienda",
  className,
  disabled = false,
  storeType = null
}: StoreSelectorProps) {
  // Fetch stores
  const { data: stores, isLoading, error } = useQuery<Store[]>({
    queryKey: storeType ? ['/api/stores', { type: storeType }] : ['/api/stores'],
    queryFn: async ({ queryKey }) => {
      const [endpoint, params] = queryKey;
      let url = endpoint as string;
      
      if (params && (params as any).type) {
        url += `?type=${(params as any).type}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Error al cargar tiendas');
      }
      return response.json();
    }
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