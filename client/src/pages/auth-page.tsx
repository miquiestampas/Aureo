import { useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileSpreadsheet, FileText } from "lucide-react";

// Login form schema
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Registration form schema
const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  name: z.string().min(2, "Name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["SuperAdmin", "Admin", "User"]).default("User"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [location, navigate] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  
  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);
  
  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  
  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      name: "",
      password: "",
      role: "User",
    },
  });
  
  // Form submission handlers
  const onLoginSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(data);
  };
  
  const onRegisterSubmit = (data: RegisterFormValues) => {
    registerMutation.mutate(data);
  };
  
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-gray-50">
      {/* Left side - Auth forms */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-primary">RetailManager</h1>
            <p className="mt-2 text-gray-600">Sign in to access your account</p>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Iniciar Sesión</CardTitle>
              <CardDescription>
                Ingrese sus credenciales para acceder al sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código de Usuario</FormLabel>
                        <FormControl>
                          <Input placeholder="Ingrese su código (5-6 dígitos)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Ingrese su contraseña" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                        Iniciando sesión...
                      </>
                    ) : (
                      "Iniciar Sesión"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex justify-center border-t pt-4">
              <p className="text-sm text-gray-500">Los usuarios son creados por el administrador del sistema</p>
            </CardFooter>
          </Card>
        </div>
      </div>
      
      {/* Right side - Hero section */}
      <div className="w-full md:w-1/2 bg-primary p-10 flex flex-col justify-center hidden md:flex">
        <div className="max-w-md mx-auto text-white">
          <h2 className="text-3xl font-bold mb-6">Retail Management System</h2>
          <p className="text-lg mb-8">
            A comprehensive solution for tracking and managing store purchases with automated file processing and monitoring.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="bg-white/10 p-3 rounded-lg mr-4">
                <FileSpreadsheet className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <h3 className="font-medium text-lg">Excel Store Processing</h3>
                <p className="text-white/80">
                  Automatically import and process Excel files containing store purchase data
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-white/10 p-3 rounded-lg mr-4">
                <FileText className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <h3 className="font-medium text-lg">PDF Document Management</h3>
                <p className="text-white/80">
                  Organize and track PDF documents by store code with our intelligent classification system
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="bg-white/10 p-3 rounded-lg mr-4">
                <svg className="h-6 w-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-lg">Real-time Monitoring</h3>
                <p className="text-white/80">
                  Automatic detection and processing of new files with real-time status updates
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
