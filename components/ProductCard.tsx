import React, { useState } from 'react';
import { Product, UserRole } from '../types';
import { Button } from './Button';
import { MessageCircle, Trash2, ShoppingBag, ChevronLeft, ChevronRight, Play, X } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  userRole: UserRole;
  onDelete?: (id: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, userRole, onDelete }) => {
  const [showContact, setShowContact] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);

  // WhatsApp link placeholder
  const whatsappNumber = "1234567890"; 
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Hi, I am interested in your product: ${product.title}`;

  // Helper to safely get current image
  const currentImage = product.images && product.images.length > 0 
    ? product.images[currentImageIndex] 
    : 'https://picsum.photos/400/400?grayscale';

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.images.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
    }
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.images.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
    }
  };

  // Helper to extract YouTube Embed URL
  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
      return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    }
    return url;
  };

  const isYouTube = product.videoUrl && (product.videoUrl.includes('youtube') || product.videoUrl.includes('youtu.be'));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
      <div className="relative aspect-square bg-gray-100 overflow-hidden group">
        
        {/* Video Player Overlay */}
        {showVideo && product.videoUrl ? (
          <div className="absolute inset-0 z-20 bg-black flex flex-col">
            <button 
                onClick={() => setShowVideo(false)} 
                className="absolute top-2 right-2 z-30 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
            >
                <X size={20} />
            </button>
            {isYouTube ? (
                <iframe 
                    src={getEmbedUrl(product.videoUrl)} 
                    className="w-full h-full" 
                    allow="autoplay; encrypted-media" 
                    allowFullScreen
                />
            ) : (
                <video src={product.videoUrl} controls autoPlay className="w-full h-full object-contain" />
            )}
          </div>
        ) : (
          <>
            <img 
              src={currentImage} 
              alt={`${product.title} - Image ${currentImageIndex + 1}`} 
              className="w-full h-full object-cover transition-transform duration-500"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://picsum.photos/400/400?grayscale';
              }}
            />
            
            {/* Play Button if Video Exists */}
            {product.videoUrl && (
                <button 
                    onClick={() => setShowVideo(true)}
                    className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors z-10"
                >
                    <div className="bg-white/90 p-3 rounded-full shadow-lg text-brand-600 scale-95 group-hover:scale-110 transition-transform">
                        <Play size={24} fill="currentColor" />
                    </div>
                </button>
            )}

            {/* Navigation Arrows (Only show if not playing video) */}
            {product.images.length > 1 && (
              <>
                <button 
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 p-1 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <ChevronLeft size={20} />
                </button>
                <button 
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 p-1 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <ChevronRight size={20} />
                </button>
                
                {/* Dots Indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {product.images.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`w-1.5 h-1.5 rounded-full shadow-sm ${idx === currentImageIndex ? 'bg-white' : 'bg-white/50'}`} 
                    />
                  ))}
                </div>
              </>
            )}
            
             <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-brand-700 shadow-sm z-10">
                ₦{product.price.toLocaleString()}
            </div>
          </>
        )}
      </div>

      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-lg font-bold text-slate-900 line-clamp-1">{product.title}</h3>
        <p className="text-sm text-slate-500 mb-3">Seller: {product.sellerName}</p>
        <p className="text-sm text-slate-600 mb-4 line-clamp-2 flex-grow">{product.description}</p>

        <div className="mt-auto pt-4 border-t border-gray-50 space-y-2">
          {userRole === UserRole.BUYER && (
            <>
              {!showContact ? (
                <Button onClick={() => setShowContact(true)}>
                  <ShoppingBag size={18} />
                  Buy Now
                </Button>
              ) : (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
                  <Button variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
                    <MessageCircle size={18} />
                    Contact on WhatsApp
                  </Button>
                </a>
              )}
            </>
          )}

          {userRole === UserRole.SELLER && onDelete && (
            <Button variant="danger" onClick={() => onDelete(product.id)}>
              <Trash2 size={18} />
              Remove Listing
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};