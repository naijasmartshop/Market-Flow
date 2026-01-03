import React, { useState, useEffect, useRef } from 'react';
import { AuthStep, User, UserRole, Product } from './types';
import { Input } from './components/Input';
import { Button } from './components/Button';
import { ProductCard } from './components/ProductCard';
import { generateProductDescription } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import { Store, LogOut, Loader2, Sparkles, Plus, Image as ImageIcon, Upload, X, Search, Video as VideoIcon, AlertTriangle, Database, RefreshCw, Settings, Link2Off } from 'lucide-react';

// Secure Admin Key
const ADMIN_KEY = "SECRETCELL1233344544552433HGFHGFFHFJFGJDII";

// Helper to safely extract error messages
const getErrorMessage = (error: any): string => {
  if (!error) return "Unknown error occurred";
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.error_description) return error.error_description;
  if (error.details) return error.details;
  return JSON.stringify(error);
};

export default function App() {
  // App State
  const [authStep, setAuthStep] = useState<AuthStep>(AuthStep.EMAIL_PASSWORD);
  const [user, setUser] = useState<User>({ email: '', username: '', role: UserRole.GUEST });
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Specific Error States
  const [isSetupRequired, setIsSetupRequired] = useState(false); // Missing table
  const [isConfigRequired, setIsConfigRequired] = useState(false); // Bad credentials/connection
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Auth Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Seller Inputs
  const [newProductTitle, setNewProductTitle] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductVideo, setNewProductVideo] = useState('');
  const [newProductImages, setNewProductImages] = useState<string[]>([]);
  const [newProductDesc, setNewProductDesc] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load User from LocalStorage (Auth is still local per requirements)
  useEffect(() => {
    const savedUser = localStorage.getItem('mf_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setAuthStep(AuthStep.COMPLETE);
    }
  }, []);

  // Fetch Products from Supabase
  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    setFetchError(null);
    setIsSetupRequired(false);
    setIsConfigRequired(false);
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        const msg = getErrorMessage(error);
        
        // Detect specific error types
        if (
             msg.includes('does not exist') || 
             msg.includes('Could not find the table') || 
             msg.includes('42P01') ||
             (error as any).code === '42P01'
        ) {
            console.log("Database setup required detected.");
            setIsSetupRequired(true);
        } else if (
            msg.includes('Failed to fetch') || 
            msg.includes('network') ||
            msg.includes('apikey') // Sometimes invalid key errors
        ) {
             console.log("Connection/Config error detected.");
             setIsConfigRequired(true);
             setFetchError(msg);
        } else {
            console.error('Error fetching products:', msg);
            setFetchError(msg);
        }
      } else {
        // Map database fields to our Product type
        const mappedProducts: Product[] = (data || []).map(item => ({
          id: item.id.toString(),
          sellerName: item.seller_name,
          title: item.title,
          description: item.description,
          price: parseFloat(item.price),
          images: item.images || [],
          videoUrl: item.video_url || undefined,
        }));
        setProducts(mappedProducts);
      }
    } catch (err: any) {
      const msg = getErrorMessage(err);
      console.error("Connection error:", msg);
      
      if (msg.includes('Failed to fetch')) {
        setIsConfigRequired(true);
      }
      
      setFetchError(msg);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  // Handlers
  const handleNextToUsername = () => {
    if (!email || !password) {
        setAuthError('Please fill in email and password.');
        return;
    }
    setAuthError('');
    setAuthStep(AuthStep.USERNAME);
  };

  const handleSignupComplete = () => {
    if (!username) {
        setAuthError('Please enter a username.');
        return;
    }
    setAuthError('');
    setUser(prev => ({ ...prev, email, username }));
    setAuthStep(AuthStep.ROLE_CHECK);
  };

  const handleRoleSelection = (hasKey: boolean) => {
    if (hasKey) {
      setAuthStep(AuthStep.ADMIN_INPUT);
    } else {
      finalizeLogin(UserRole.BUYER);
    }
  };

  const handleAdminKeySubmit = () => {
    if (adminKeyInput === ADMIN_KEY) {
      finalizeLogin(UserRole.SELLER);
    } else {
        setAuthError("INVALID CODE");
    }
  };

  const finalizeLogin = (role: UserRole) => {
    const newUser = { email, username, role };
    setUser(newUser);
    localStorage.setItem('mf_user', JSON.stringify(newUser));
    setAuthStep(AuthStep.COMPLETE);
  };

  const handleLogout = () => {
    localStorage.removeItem('mf_user');
    setUser({ email: '', username: '', role: UserRole.GUEST });
    setAuthStep(AuthStep.EMAIL_PASSWORD);
    setEmail('');
    setPassword('');
    setUsername('');
    setAdminKeyInput('');
    setAuthError('');
  };

  // Image Upload Logic
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const remainingSlots = 3 - newProductImages.length;
    
    if (remainingSlots <= 0) {
      alert("You have already selected 3 images.");
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots) as File[];
    
    if (files.length > remainingSlots) {
      alert(`Only the first ${remainingSlots} images were added. Max 3 allowed.`);
    }

    filesToProcess.forEach(file => {
      // Basic size check: 500KB limit for Base64 storage stability
      if (file.size > 500000) {
         alert(`Image ${file.name} is too large. Please use images under 500KB.`);
         return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
            setNewProductImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setNewProductImages(prev => prev.filter((_, i) => i !== index));
  };

  // Seller Logic
  const generateDescription = async () => {
    if (!newProductTitle || !newProductPrice) {
        alert("Please enter a title and price first.");
        return;
    }
    setIsGenerating(true);
    const desc = await generateProductDescription(newProductTitle, parseFloat(newProductPrice));
    setNewProductDesc(desc);
    setIsGenerating(false);
  };

  const addProduct = async () => {
    if (!newProductTitle || !newProductPrice) {
      alert("Title and Price are required.");
      return;
    }
    
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('products')
        .insert([
          { 
            seller_name: user.username,
            title: newProductTitle,
            price: parseFloat(newProductPrice),
            description: newProductDesc || 'No description provided.',
            images: newProductImages.length > 0 ? newProductImages : [`https://picsum.photos/500/500?random=${Date.now()}`],
            video_url: newProductVideo || null
          }
        ])
        .select();

      if (error) {
        const msg = getErrorMessage(error);
        if (msg.includes('does not exist') || msg.includes('Could not find the table') || (error as any).code === '42P01') {
           setIsSetupRequired(true);
        } else if (msg.includes('Failed to fetch')) {
           setIsConfigRequired(true);
        } else {
           console.error(error);
           alert("Error saving product: " + msg);
        }
      } else {
        // Refresh local list
        fetchProducts();
        // Reset form
        setNewProductTitle('');
        setNewProductPrice('');
        setNewProductVideo('');
        setNewProductDesc('');
        setNewProductImages([]);
      }
    } catch (err) {
      console.error(err);
      const msg = getErrorMessage(err);
      if (msg.includes('Failed to fetch')) setIsConfigRequired(true);
      else alert("An unexpected error occurred: " + msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this listing?")) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) {
        alert("Error deleting product: " + getErrorMessage(error));
      } else {
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- RENDER HELPERS ---

  const renderAuth = () => {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-brand-50">
        <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl border border-white/50 backdrop-blur-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-600">
              <Store size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Welcome to MarketFlow</h1>
            <p className="text-slate-500 mt-2 text-sm">Experience the future of commerce.</p>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm font-bold rounded-xl text-center border border-red-100">
                {authError}
            </div>
          )}

          {authStep === AuthStep.EMAIL_PASSWORD && (
            <div className="animate-fade-in">
              <Input 
                type="email" 
                placeholder="name@example.com" 
                label="Email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <Input 
                type="password" 
                placeholder="••••••••" 
                label="Password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <Button onClick={handleNextToUsername}>Next</Button>
            </div>
          )}

          {authStep === AuthStep.USERNAME && (
            <div className="animate-fade-in">
               <Input 
                type="text" 
                placeholder="SuperUser123" 
                label="Choose a Username" 
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
              <Button onClick={handleSignupComplete}>Sign Up</Button>
              <button 
                onClick={() => setAuthStep(AuthStep.EMAIL_PASSWORD)}
                className="w-full mt-4 text-sm text-slate-400 hover:text-slate-600"
              >
                Back
              </button>
            </div>
          )}

          {authStep === AuthStep.ROLE_CHECK && (
            <div className="animate-fade-in space-y-4">
              <h3 className="text-lg font-semibold text-center text-slate-700">Do you have an admin key?</h3>
              <Button onClick={() => {
                  setAuthError('');
                  handleRoleSelection(true);
              }}>Yes, I have a key</Button>
              <Button variant="secondary" onClick={() => handleRoleSelection(false)}>No, I'm a buyer</Button>
            </div>
          )}

          {authStep === AuthStep.ADMIN_INPUT && (
            <div className="animate-fade-in">
               <Input 
                type="text" 
                placeholder="Enter key..." 
                label="Admin Verification" 
                value={adminKeyInput}
                onChange={e => {
                    setAdminKeyInput(e.target.value);
                    if (authError) setAuthError('');
                }}
              />
              <Button onClick={handleAdminKeySubmit}>Verify & Enter</Button>
              <Button 
                variant="secondary" 
                className="mt-3"
                onClick={() => finalizeLogin(UserRole.BUYER)}
              >
                I can't find it (Enter as Buyer)
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    // Filter logic
    const filteredProducts = products.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    const showLoading = isLoadingProducts && !isConfigRequired && !isSetupRequired;
    const showEmptyState = !isLoadingProducts && !isConfigRequired && !isSetupRequired && filteredProducts.length === 0;

    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <div className="bg-brand-600 p-1.5 rounded-lg text-white">
                <Store size={20} />
              </div>
              <span className="font-bold text-xl text-slate-800 tracking-tight hidden sm:block">MarketFlow</span>
            </div>
            
            {/* Search Bar */}
            <div className="flex-1 max-w-lg relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search size={18} />
                </div>
                <input 
                    type="text"
                    placeholder="Search products..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full text-sm focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="flex items-center gap-4 shrink-0">
                <div className="hidden sm:flex flex-col items-end">
                    <span className="text-sm font-semibold text-slate-700">{user.username}</span>
                    <span className="text-xs text-brand-600 font-medium px-2 py-0.5 bg-brand-50 rounded-full">{user.role}</span>
                </div>
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                    <LogOut size={20} />
                </button>
            </div>
          </div>
        </header>

        <main className="max-