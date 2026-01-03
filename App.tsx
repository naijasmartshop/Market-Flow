import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
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
      
      if (msg.includes('Failed to fetch') || msg.includes('network')) {
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
        } else if (msg.includes('Failed to fetch') || msg.includes('apikey')) {
           setIsConfigRequired(true);
        } else {
           console.error(error);
           alert("Error saving product: " + msg);
        }
      } else {
        // Refresh local list
        fetchProducts();
        // Reset form completely
        setNewProductTitle('');
        setNewProductPrice('');
        setNewProductVideo('');
        setNewProductDesc('');
        setNewProductImages([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
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

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            
          {/* CONFIG REQUIRED STATE */}
          {isConfigRequired && (
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-red-100 overflow-hidden animate-fade-in mb-8">
                <div className="bg-red-50 p-6 border-b border-red-100 flex items-center gap-4">
                    <div className="bg-white p-3 rounded-xl shadow-sm text-red-600">
                        <Link2Off size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-red-900">Connection Failed</h2>
                        <p className="text-red-700 text-sm">We could not connect to your Supabase backend.</p>
                    </div>
                </div>
                <div className="p-6">
                    <p className="text-slate-700 mb-4">
                        This usually happens because the Supabase URL or Anon Key has not been set in the code yet.
                    </p>
                    
                    <div className="bg-slate-900 rounded-lg p-4 mb-4 overflow-x-auto">
                        <code className="text-xs font-mono text-white">
                            // In services/supabaseClient.ts<br/>
                            const supabaseUrl = 'https://YOUR_PROJECT_ID.supabase.co';<br/>
                            const supabaseKey = 'YOUR_ANON_KEY';
                        </code>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={() => fetchProducts()} className="w-auto px-6 py-2">
                            <RefreshCw size={16} />
                            Try Again
                        </Button>
                    </div>
                </div>
            </div>
          )}

          {/* SETUP REQUIRED STATE - Friendly UI for missing table */}
          {isSetupRequired && !isConfigRequired && (
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-brand-100 overflow-hidden animate-fade-in mb-8">
                <div className="bg-brand-50 p-6 border-b border-brand-100 flex items-center gap-4">
                    <div className="bg-white p-3 rounded-xl shadow-sm text-brand-600">
                        <Database size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-brand-900">Database Setup Required</h2>
                        <p className="text-brand-700 text-sm">Welcome! MarketFlow needs to create a table in your Supabase project to start storing products.</p>
                    </div>
                </div>
                <div className="p-6">
                    <div className="flex gap-4 items-start mb-6">
                        <div className="bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center shrink-0 font-bold text-slate-600">1</div>
                        <div>
                            <p className="font-semibold text-slate-800">Copy the SQL code below</p>
                            <p className="text-sm text-slate-500">This code defines the structure for your products.</p>
                        </div>
                    </div>
                    
                    <div className="relative group mb-6">
                         <pre className="text-xs bg-slate-900 text-green-400 p-4 rounded-xl font-mono overflow-auto whitespace-pre border border-slate-700 shadow-inner">
{`create table products (
  id bigint generated by default as identity primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  seller_name text,
  title text,
  description text,
  price numeric,
  images text[],
  video_url text
);

-- Enable public access for this prototype
alter table products enable row level security;
create policy "Public Access" on products for all using (true) with check (true);`}
                        </pre>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <span className="bg-white/20 text-white text-xs px-2 py-1 rounded">Click and copy manually</span>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start mb-8">
                        <div className="bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center shrink-0 font-bold text-slate-600">2</div>
                        <div>
                            <p className="font-semibold text-slate-800">Run it in Supabase SQL Editor</p>
                            <p className="text-sm text-slate-500">Go to your Supabase Dashboard &gt; SQL Editor &gt; New Query &gt; Paste &gt; Run.</p>
                        </div>
                    </div>

                    <div className="bg-brand-50 rounded-xl p-4 flex items-center justify-between">
                         <p className="text-brand-800 font-medium text-sm">Done running the code?</p>
                         <Button onClick={() => fetchProducts()} className="w-auto px-6 py-2">
                            <RefreshCw size={16} />
                            Refresh App
                         </Button>
                    </div>
                </div>
            </div>
          )}

          {/* Regular Error Banner (For other errors) */}
          {fetchError && !isSetupRequired && !isConfigRequired && (
             <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 animate-fade-in">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                        <h3 className="text-red-800 font-bold">Unable to load products</h3>
                        <p className="text-red-600 mt-1 text-sm">{fetchError}</p>
                    </div>
                </div>
             </div>
          )}

          {/* SELLER SECTION (Only show if setup is done and config is good) */}
          {user.role === UserRole.SELLER && !isSetupRequired && !isConfigRequired && (
            <div className="mb-12">
               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                 <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
                    <Plus className="text-brand-600" />
                    Add New Product
                 </h2>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <Input 
                            label="Product Title" 
                            placeholder="e.g. Vintage Camera"
                            value={newProductTitle}
                            onChange={(e) => setNewProductTitle(e.target.value)}
                        />
                         <div className="relative">
                            <span className="absolute left-4 top-[38px] text-slate-400">₦</span>
                            <Input 
                                label="Price (Naira)" 
                                type="number"
                                placeholder="0.00"
                                className="pl-8"
                                value={newProductPrice}
                                onChange={(e) => setNewProductPrice(e.target.value)}
                            />
                        </div>

                        <Input 
                            label="Video Link (YouTube or MP4)" 
                            placeholder="https://youtu.be/example"
                            value={newProductVideo}
                            onChange={(e) => setNewProductVideo(e.target.value)}
                        />
                         
                         {/* Image Upload Area */}
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Product Images (Max 3)
                            </label>
                            
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                className="hidden" 
                                accept="image/*" 
                                multiple 
                                onChange={handleImageUpload}
                            />
                            
                            <div className="grid grid-cols-3 gap-3 mb-2">
                                {newProductImages.map((img, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                                        <img src={img} alt="Preview" className="w-full h-full object-cover" />
                                        <button 
                                            onClick={() => removeImage(idx)}
                                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                                {newProductImages.length < 3 && (
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-brand-500 hover:bg-brand-50 flex flex-col items-center justify-center text-slate-400 hover:text-brand-600 transition-colors"
                                    >
                                        <Upload size={20} className="mb-1" />
                                        <span className="text-xs">Add Photo</span>
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-slate-500">
                                {newProductImages.length}/3 images selected.
                            </p>
                         </div>
                    </div>
                    
                    <div className="flex flex-col">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                        <textarea 
                            className="w-full flex-grow px-4 py-3 rounded-xl border border-gray-200 bg-white text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all resize-none mb-3"
                            placeholder="Describe your product..."
                            rows={4}
                            value={newProductDesc}
                            onChange={(e) => setNewProductDesc(e.target.value)}
                        />
                        <div className="flex gap-3 mt-auto">
                            <Button 
                                variant="secondary" 
                                onClick={generateDescription}
                                disabled={isGenerating}
                                className="flex-1 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100 hover:from-indigo-100 hover:to-purple-100 text-indigo-700"
                            >
                                {isGenerating ? (
                                    <>Thinking...</>
                                ) : (
                                    <>
                                        <Sparkles size={16} />
                                        Ask AI to Write
                                    </>
                                )}
                            </Button>
                            <Button onClick={addProduct} disabled={isSubmitting} className="flex-[2]">
                                {isSubmitting ? 'Publishing...' : 'Publish Product'}
                            </Button>
                        </div>
                    </div>
                 </div>
               </div>
               
               <div className="mt-8 mb-4 flex items-center justify-between">
                 <h3 className="text-lg font-bold text-slate-800">Your Listings</h3>
               </div>
            </div>
          )}

          {/* PRODUCT GRID (Visible to Both) */}
          {user.role === UserRole.BUYER && !isSetupRequired && !isConfigRequired && (
             <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Discover Products</h2>
                <p className="text-slate-500">Curated items just for you.</p>
             </div>
          )}

          {!isSetupRequired && !isConfigRequired && (
              isLoadingProducts ? (
                 <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                 </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-20 opacity-50">
                    <div className="bg-gray-200 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
                        {searchQuery ? <Search size={32} /> : <ImageIcon size={32} />}
                    </div>
                    {!fetchError && (
                        <p className="text-lg font-medium text-slate-600">
                            {searchQuery ? "Product not found." : "No products available yet."}
                        </p>
                    )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map(product => (
                        <ProductCard 
                            key={product.id} 
                            product={product} 
                            userRole={user.role} 
                            onDelete={user.role === UserRole.SELLER ? deleteProduct : undefined}
                        />
                    ))}
                </div>
              )
          )}
        </main>
      </div>
    );
  };

  if (authStep !== AuthStep.COMPLETE) {
    return renderAuth();
  }

  return renderDashboard();
}