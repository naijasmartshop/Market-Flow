import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { AuthStep, User, UserRole, Product } from './types';
import { Input } from './components/Input';
import { Button } from './components/Button';
import { ProductCard } from './components/ProductCard';
import { generateProductDescription } from './services/geminiService';
import { supabase, updateSupabaseConfig, getCurrentConfig, resetSupabaseConfig } from './services/supabaseClient';
import { Store, LogOut, Loader2, Sparkles, Plus, Image as ImageIcon, Upload, X, Search, Video as VideoIcon, AlertTriangle, Database, RefreshCw, Settings, Link2Off, User as UserIcon, Lock, Mail, ShieldCheck, Camera, UserCircle } from 'lucide-react';

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
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [appLoading, setAppLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Auth State
  const [authStep, setAuthStep] = useState<AuthStep>(AuthStep.EMAIL_PASSWORD);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.BUYER);
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [sbConfig, setSbConfig] = useState(getCurrentConfig());

  // Product Form State
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductTitle, setNewProductTitle] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductImages, setNewProductImages] = useState<string[]>([]);
  const [newImageInput, setNewImageInput] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Refs for file inputs
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const productFileInputRef = useRef<HTMLInputElement>(null);

  // --- Initialization ---

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    setAppLoading(true);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.warn("Session check error:", error);
        // Don't block app on session error, just user is null
      }
      
      if (session?.user) {
        const metadata = session.user.user_metadata;
        setUser({
          email: session.user.email || '',
          username: metadata.username || session.user.email?.split('@')[0] || 'User',
          role: metadata.role || UserRole.BUYER,
          avatar: metadata.avatar
        });
        fetchProducts();
      }
    } catch (err) {
      console.error("Unexpected session error:", err);
    } finally {
      setAppLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to match Product interface (handle single image legacy vs new array)
      const formattedProducts: Product[] = (data || []).map(p => ({
        ...p,
        // Ensure images is an array
        images: Array.isArray(p.images) ? p.images : (p.imageUrl ? [p.imageUrl] : [])
      }));

      setProducts(formattedProducts);
    } catch (err: any) {
      console.error("Fetch products error:", err);
      // Don't show error to user immediately on fetch fail, just log
    } finally {
      setLoading(false);
    }
  };

  // --- Auth Handlers ---

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Limit size to ~500KB for base64
      if (file.size > 500 * 1024) {
        setError("Image size too large. Please choose an image under 500KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for products
        setError("Image size too large. Please choose an image under 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProductImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          const metadata = data.user.user_metadata;
          setUser({
            email: data.user.email || '',
            username: metadata.username || 'User',
            role: metadata.role || UserRole.BUYER,
            avatar: metadata.avatar,
          });
          fetchProducts();
        }
      } else {
        // Signup Flow
        if (authStep === AuthStep.EMAIL_PASSWORD) {
          // Validate basics
          if (password.length < 6) throw new Error("Password must be at least 6 characters");
          setAuthStep(AuthStep.USERNAME);
          setLoading(false);
          return;
        }

        if (authStep === AuthStep.USERNAME) {
          if (!username.trim()) throw new Error("Username is required");
          setAuthStep(AuthStep.ROLE_CHECK);
          setLoading(false);
          return;
        }

        if (authStep === AuthStep.ROLE_CHECK) {
            if (selectedRole === UserRole.SELLER) {
                setAuthStep(AuthStep.ADMIN_INPUT);
                setLoading(false);
                return;
            } else {
                // Proceed to complete for Buyer
                await completeSignup();
                return;
            }
        }

        if (authStep === AuthStep.ADMIN_INPUT) {
            if (adminKeyInput !== ADMIN_KEY) {
                throw new Error("Invalid Admin Key");
            }
            await completeSignup();
        }
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  const completeSignup = async () => {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username,
                    role: selectedRole,
                    avatar: avatar // Save avatar to metadata
                }
            }
        });

        if (error) throw error;

        // Auto login after signup if session is established (Supabase default usually requires email confirm unless disabled)
        // If 'data.session' is null, email confirmation might be on.
        if (data.user && !data.session) {
            setError("Account created! Please check your email to verify your account.");
            // Reset to login
            setIsLogin(true);
            setAuthStep(AuthStep.EMAIL_PASSWORD);
        } else if (data.user && data.session) {
            setUser({
                email: data.user.email || '',
                username: username,
                role: selectedRole,
                avatar: avatar
            });
            fetchProducts();
        }
    } catch (err: any) {
        setError(getErrorMessage(err));
    } finally {
        setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProducts([]);
    setAuthStep(AuthStep.EMAIL_PASSWORD);
    setEmail('');
    setPassword('');
    setAvatar('');
  };

  // --- Product Handlers ---

  const handleGenerateDescription = async () => {
    if (!newProductTitle || !newProductPrice) {
      setError("Please enter title and price first");
      return;
    }
    
    setIsGeneratingAI(true);
    try {
      const desc = await generateProductDescription(newProductTitle, parseFloat(newProductPrice));
      setNewProductDesc(desc);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const addImageToProduct = () => {
    if (newImageInput.trim()) {
        setNewProductImages([...newProductImages, newImageInput.trim()]);
        setNewImageInput('');
    }
  };

  const removeImage = (index: number) => {
    setNewProductImages(newProductImages.filter((_, i) => i !== index));
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Validate
    if (newProductImages.length === 0) {
        setError("Please add at least one image.");
        return;
    }

    setLoading(true);
    try {
      const newProd = {
        title: newProductTitle,
        description: newProductDesc,
        price: parseFloat(newProductPrice),
        images: newProductImages, // Use the array
        videoUrl: newVideoUrl || null,
        sellerName: user.username,
        user_id: (await supabase.auth.getUser()).data.user?.id
      };

      const { error } = await supabase.from('products').insert([newProd]);
      if (error) throw error;

      setShowAddProduct(false);
      resetProductForm();
      fetchProducts();
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      fetchProducts();
    } catch (err: any) {
      alert("Failed to delete: " + getErrorMessage(err));
    }
  };

  const resetProductForm = () => {
    setNewProductTitle('');
    setNewProductPrice('');
    setNewProductDesc('');
    setNewProductImages([]);
    setNewVideoUrl('');
    setNewImageInput('');
  };

  // --- Render Helpers ---

  const renderAuthForm = () => {
    return (
      <div className="w-full max-w-md p-8 bg-white rounded-3xl shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 mb-4 shadow-sm">
            <Store size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {isLogin ? 'Welcome Back' : 'Join MarketFlow'}
          </h1>
          <p className="text-slate-500">
            {isLogin ? 'Enter your details to access your account' : 'Start your buying and selling journey'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-start gap-2 border border-red-100">
            <AlertTriangle className="shrink-0 mt-0.5" size={16} />
            <span className="flex-1 break-words">{error}</span>
            <button onClick={() => setError(null)}><X size={16}/></button>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          
          {/* Step 1: Email & Password */}
          {authStep === AuthStep.EMAIL_PASSWORD && (
            <>
              <Input
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </>
          )}

          {/* Step 2: Username & Avatar (Signup Only) */}
          {!isLogin && authStep === AuthStep.USERNAME && (
            <div className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                    <div 
                        className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors relative group"
                        onClick={() => avatarInputRef.current?.click()}
                    >
                        {avatar ? (
                            <img src={avatar} alt="Avatar Preview" className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center text-gray-400">
                                <Camera size={24} />
                                <span className="text-xs mt-1">Upload</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs font-medium">Change</span>
                        </div>
                    </div>
                    <input 
                        type="file" 
                        ref={avatarInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleAvatarUpload}
                    />
                    <p className="text-sm text-slate-500">Set your profile picture</p>
                </div>

              <Input
                label="Choose a Username"
                type="text"
                placeholder="@username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
          )}

          {/* Step 3: Role Selection (Signup Only) */}
          {!isLogin && authStep === AuthStep.ROLE_CHECK && (
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setSelectedRole(UserRole.BUYER)}
                className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                  selectedRole === UserRole.BUYER
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-gray-200 hover:border-brand-200 hover:bg-gray-50'
                }`}
              >
                <div className="p-3 bg-white rounded-full shadow-sm">
                    <UserIcon size={24} />
                </div>
                <span className="font-semibold">Buyer</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole(UserRole.SELLER)}
                className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                  selectedRole === UserRole.SELLER
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-gray-200 hover:border-brand-200 hover:bg-gray-50'
                }`}
              >
                <div className="p-3 bg-white rounded-full shadow-sm">
                    <Store size={24} />
                </div>
                <span className="font-semibold">Seller</span>
              </button>
            </div>
          )}

          {/* Step 4: Admin Key (Seller Signup Only) */}
          {!isLogin && authStep === AuthStep.ADMIN_INPUT && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl mb-4 text-sm flex gap-2">
                <Lock size={16} className="shrink-0 mt-0.5" />
                Seller accounts require an admin invitation key.
              </div>
              <Input
                label="Admin Access Key"
                type="password"
                placeholder="Enter access key..."
                value={adminKeyInput}
                onChange={(e) => setAdminKeyInput(e.target.value)}
                autoFocus
                required
              />
            </div>
          )}

          <Button type="submit" isLoading={loading} className="mt-6">
            {isLogin 
              ? 'Sign In' 
              : authStep === AuthStep.EMAIL_PASSWORD 
                ? 'Continue' 
                : authStep === AuthStep.USERNAME
                  ? 'Continue'
                  : authStep === AuthStep.ROLE_CHECK 
                    ? (selectedRole === UserRole.BUYER ? 'Complete Setup' : 'Continue') 
                    : 'Verify & Create Account'
            }
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setAuthStep(AuthStep.EMAIL_PASSWORD);
              setError(null);
              setAvatar('');
            }}
            className="text-sm font-medium text-slate-500 hover:text-brand-600 transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>

        {/* Database Config Toggle */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
            <button 
                onClick={() => setShowConfig(!showConfig)}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600"
            >
                <Settings size={12} />
                Connection Settings
            </button>
        </div>
        
        {showConfig && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl text-xs space-y-3 animate-in slide-in-from-top-2">
                <div>
                    <label className="block text-slate-500 mb-1">Supabase URL</label>
                    <input 
                        className="w-full p-2 rounded border border-gray-200"
                        value={sbConfig.url} 
                        onChange={(e) => setSbConfig({...sbConfig, url: e.target.value})} 
                    />
                </div>
                <div>
                    <label className="block text-slate-500 mb-1">Supabase Key</label>
                    <input 
                        className="w-full p-2 rounded border border-gray-200"
                        value={sbConfig.key} 
                        onChange={(e) => setSbConfig({...sbConfig, key: e.target.value})} 
                    />
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="secondary" 
                        onClick={() => updateSupabaseConfig(sbConfig.url, sbConfig.key)}
                        className="py-1 text-xs"
                    >
                        Save & Reload
                    </Button>
                     <Button 
                        variant="danger" 
                        onClick={resetSupabaseConfig}
                        className="py-1 text-xs"
                    >
                        Reset Default
                    </Button>
                </div>
            </div>
        )}
      </div>
    );
  };

  // --- Main Render ---

  if (appLoading) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white flex items-center justify-center p-4">
        {renderAuthForm()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-brand-600 text-white p-2 rounded-lg">
              <Store size={20} />
            </div>
            <span className="font-bold text-xl text-slate-900 hidden sm:block">MarketFlow</span>
          </div>

          <div className="flex-1 max-w-md mx-4 hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search products..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent focus:bg-white focus:border-brand-500 rounded-lg text-sm transition-all outline-none border"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            {user.role === UserRole.SELLER && (
              <Button 
                onClick={() => setShowAddProduct(true)}
                className="!w-auto !py-2 !px-4 text-sm hidden sm:flex"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Add Product</span>
              </Button>
            )}

            {/* User Profile in Header */}
            <div className="flex items-center gap-3 pl-3 border-l border-gray-100">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-sm font-medium text-slate-900">{user.username}</span>
                <span className="text-xs text-slate-500 capitalize">{user.role.toLowerCase()}</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-brand-100 border border-brand-200 flex items-center justify-center overflow-hidden">
                {user.avatar ? (
                    <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                    <span className="font-bold text-brand-700">{user.username.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
                title="Sign Out"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Search Bar */}
        <div className="md:hidden px-4 pb-3">
             <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search products..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent focus:bg-white focus:border-brand-500 rounded-lg text-sm transition-all outline-none border"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Mobile Add Product Button */}
        {user.role === UserRole.SELLER && (
            <div className="sm:hidden mb-6">
                 <Button onClick={() => setShowAddProduct(true)}>
                    <Plus size={18} />
                    Add New Product
                  </Button>
            </div>
        )}

        {products.length === 0 && !loading ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <ShoppingBag size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No products yet</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              The marketplace is currently empty. 
              {user.role === UserRole.SELLER && " Be the first to list an item!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products
                .filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((product) => (
              <ProductCard 
                key={product.id} 
                product={product} 
                userRole={user.role}
                onDelete={handleDeleteProduct}
              />
            ))}
          </div>
        )}
      </main>

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-900">List New Product</h2>
              <button 
                onClick={() => setShowAddProduct(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddProduct} className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Input
                  label="Product Title"
                  placeholder="e.g. Vintage Camera"
                  value={newProductTitle}
                  onChange={(e) => setNewProductTitle(e.target.value)}
                  required
                />
                <div className="relative">
                  <Input
                    label="Price ($)"
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Description</label>
                  <button
                    type="button"
                    onClick={handleGenerateDescription}
                    disabled={isGeneratingAI}
                    className="text-xs flex items-center gap-1 text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50"
                  >
                    <Sparkles size={12} />
                    {isGeneratingAI ? 'Generating...' : 'Generate with AI'}
                  </button>
                </div>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all h-32 resize-none"
                  placeholder="Describe your product..."
                  value={newProductDesc}
                  onChange={(e) => setNewProductDesc(e.target.value)}
                  required
                />
              </div>

              <div>
                 <label className="text-sm font-medium text-slate-700 mb-2 block">Product Images</label>
                 
                 {/* Image List */}
                 {newProductImages.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                        {newProductImages.map((img, idx) => (
                            <div key={idx} className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group">
                                <img src={img} alt="Product" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => removeImage(idx)}
                                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                 )}

                 <div className="flex gap-2">
                    <div className="flex-1">
                         <Input
                            placeholder="Paste Image URL"
                            value={newImageInput}
                            onChange={(e) => setNewImageInput(e.target.value)}
                            className="mb-0"
                        />
                    </div>
                    <Button type="button" onClick={addImageToProduct} variant="secondary" className="!w-auto">
                        Add
                    </Button>
                    <button
                        type="button"
                        onClick={() => productFileInputRef.current?.click()}
                        className="px-4 border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center justify-center text-slate-600"
                        title="Upload Image"
                    >
                        <Upload size={20} />
                    </button>
                    <input 
                        type="file" 
                        ref={productFileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleProductImageUpload}
                    />
                 </div>
                 <p className="text-xs text-slate-400 mt-1">Add multiple images via URL or Upload.</p>
              </div>

              <div className="space-y-2">
                 <label className="text-sm font-medium text-slate-700">Video Demo (Optional)</label>
                 <div className="flex items-center gap-2">
                    <VideoIcon size={20} className="text-slate-400" />
                    <input 
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all"
                        placeholder="YouTube or Video URL"
                        value={newVideoUrl}
                        onChange={(e) => setNewVideoUrl(e.target.value)}
                    />
                 </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <Button type="button" variant="secondary" onClick={() => setShowAddProduct(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={loading}>
                  Post Listing
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ShoppingBag({ size, className }: { size?: number, className?: string }) {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={size || 24} 
            height={size || 24} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={className}
        >
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
    )
}
