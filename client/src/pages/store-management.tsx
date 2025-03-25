import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PlusCircle,
  Store,
  FileSpreadsheet,
  FileText,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle
} from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";

interface StoreData {
  id: number;
  code: string;
  name: string;
  type: string;
  location: string;
  active: boolean;
}

// Form schema for creating/editing a store
const storeFormSchema = z.object({
  code: z.string().min(2, "Store code must be at least 2 characters").max(20, "Store code must be at most 20 characters"),
  name: z.string().min(2, "Store name must be at least 2 characters"),
  type: z.enum(["Excel", "PDF"]),
  location: z.string().optional(),
  active: z.boolean().default(true),
});

type StoreFormValues = z.infer<typeof storeFormSchema>;

export default function StoreManagementPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreData | null>(null);

  // Fetch all stores
  const { data: stores, refetch: refetchStores } = useQuery<StoreData[]>({
    queryKey: ['/api/stores'],
  });
  
  // Create store form
  const createForm = useForm<StoreFormValues>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: {
      code: "",
      name: "",
      type: "Excel",
      location: "",
      active: true,
    },
  });
  
  // Edit store form
  const editForm = useForm<StoreFormValues>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: {
      code: "",
      name: "",
      type: "Excel",
      location: "",
      active: true,
    },
  });
  
  // Set edit form values when a store is selected
  useEffect(() => {
    if (selectedStore && isEditDialogOpen) {
      editForm.reset({
        code: selectedStore.code,
        name: selectedStore.name,
        type: selectedStore.type as "Excel" | "PDF",
        location: selectedStore.location || "",
        active: selectedStore.active,
      });
    }
  }, [selectedStore, isEditDialogOpen, editForm]);
  
  // Create store mutation
  const createMutation = useMutation({
    mutationFn: async (data: StoreFormValues) => {
      const response = await apiRequest("POST", "/api/stores", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Store created",
        description: "The store has been created successfully.",
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
      refetchStores();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create store",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update store mutation
  const updateMutation = useMutation({
    mutationFn: async (data: StoreFormValues & { id: number }) => {
      const { id, ...storeData } = data;
      const response = await apiRequest("PUT", `/api/stores/${id}`, storeData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Store updated",
        description: "The store has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setSelectedStore(null);
      refetchStores();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update store",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Delete store mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/stores/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Store deleted",
        description: "The store has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      setSelectedStore(null);
      refetchStores();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete store",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Handle create form submission
  const onCreateSubmit = (data: StoreFormValues) => {
    createMutation.mutate(data);
  };
  
  // Handle edit form submission
  const onEditSubmit = (data: StoreFormValues) => {
    if (!selectedStore) return;
    
    updateMutation.mutate({
      id: selectedStore.id,
      ...data,
    });
  };
  
  // Handle delete confirmation
  const confirmDelete = () => {
    if (!selectedStore) return;
    deleteMutation.mutate(selectedStore.id);
  };
  
  // Open edit dialog for a store
  const handleEditStore = (store: StoreData) => {
    setSelectedStore(store);
    setIsEditDialogOpen(true);
  };
  
  // Open delete dialog for a store
  const handleDeleteStore = (store: StoreData) => {
    setSelectedStore(store);
    setIsDeleteDialogOpen(true);
  };
  
  // Check if user can edit/delete (only SuperAdmin and Admin)
  const canModify = user?.role === "SuperAdmin" || user?.role === "Admin";
  
  // Data table columns
  const columns: ColumnDef<StoreData>[] = [
    {
      accessorKey: "code",
      header: "Store Code",
    },
    {
      accessorKey: "name",
      header: "Store Name",
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.original.type;
        return (
          <div className="flex items-center">
            {type === "Excel" ? (
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <FileText className="h-4 w-4 mr-2 text-red-500" />
            )}
            {type}
          </div>
        );
      }
    },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => {
        return row.original.location || "—";
      }
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => {
        const isActive = row.original.active;
        return isActive ? (
          <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" /> Active
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" /> Inactive
          </Badge>
        );
      }
    },
    ...(canModify ? [
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const store = row.original;
          return (
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={() => handleEditStore(store)}
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 w-8 p-0 text-red-500 hover:text-red-600" 
                onClick={() => handleDeleteStore(store)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          );
        }
      }
    ] : []),
  ];
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Store Management</h1>
            <p className="text-gray-500 mt-1">Manage your Excel and PDF stores</p>
          </div>
          
          {canModify && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add New Store
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Store</DialogTitle>
                  <DialogDescription>
                    Add a new store to the system.
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 py-4">
                    <FormField
                      control={createForm.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Store Code</FormLabel>
                          <FormControl>
                            <Input placeholder="E.g., ST001" {...field} />
                          </FormControl>
                          <FormDescription>
                            A unique identifier for the store
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Store Name</FormLabel>
                          <FormControl>
                            <Input placeholder="E.g., Main Street Store" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Store Type</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select store type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Excel">Excel Store</SelectItem>
                              <SelectItem value="PDF">PDF Store</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Determines how the store's data is processed
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="E.g., Downtown" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="active"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Active Status</FormLabel>
                            <FormDescription>
                              Active stores will process new files
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <DialogFooter>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsCreateDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={createMutation.isPending}
                      >
                        {createMutation.isPending ? "Creating..." : "Create Store"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        
        {/* Stores Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Store className="h-5 w-5 mr-2 text-primary" />
              <CardTitle>All Stores</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {stores?.length ? (
              <DataTable
                columns={columns}
                data={stores}
                searchKey="name"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Store className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No stores found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a new store to get started.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Edit Store Dialog */}
        {selectedStore && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Store</DialogTitle>
                <DialogDescription>
                  Update the store information.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={editForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store Code</FormLabel>
                        <FormControl>
                          <Input placeholder="E.g., ST001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store Name</FormLabel>
                        <FormControl>
                          <Input placeholder="E.g., Main Street Store" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store Type</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select store type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Excel">Excel Store</SelectItem>
                            <SelectItem value="PDF">PDF Store</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="E.g., Downtown" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active Status</FormLabel>
                          <FormDescription>
                            Active stores will process new files
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsEditDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? "Updating..." : "Update Store"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
        
        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action will permanently delete the store "{selectedStore?.name}". 
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
