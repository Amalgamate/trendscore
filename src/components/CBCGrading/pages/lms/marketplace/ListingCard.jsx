/**
 * ListingCard — Individual listing card for marketplace grid
 * Displays: title, seller, price, rating, purchase button
 */

import React from 'react';
import {
  Star,
  DollarSign,
  ShoppingCart,
  User,
  Download,
} from 'lucide-react';

export default function ListingCard({ listing, onPurchase }) {
  const {
    id,
    title,
    description,
    price,
    listingType,
    currency,
    rating,
    ratingCount,
    purchaseCount,
    downloadCount,
    seller,
  } = listing;

  const renderPrice = () => {
    if (listingType === 'FREE') {
      return <span className="text-lg font-bold text-emerald-600">Free</span>;
    }
    return (
      <span className="text-lg font-bold text-gray-900">
        {currency === 'KES' ? 'KES ' : ''}{price.toLocaleString()}
      </span>
    );
  };

  const renderRating = () => {
    if (!rating) return <span className="text-sm text-gray-500">No ratings</span>;
    return (
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={14}
              className={i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
            />
          ))}
        </div>
        <span className="text-xs text-gray-600">({ratingCount})</span>
      </div>
    );
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-gray-600 line-clamp-2">{description}</p>
        )}
      </div>

      {/* Seller & Rating */}
      <div className="px-4 pt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs">
          <User size={14} className="text-gray-400" />
          <span className="text-gray-600">
            {seller?.firstName} {seller?.lastName}
          </span>
        </div>
        {renderRating()}
      </div>

      {/* Stats */}
      <div className="px-4 py-2 flex gap-3 text-xs text-gray-600 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <ShoppingCart size={14} />
          {purchaseCount} sales
        </div>
        <div className="flex items-center gap-1">
          <Download size={14} />
          {downloadCount} downloads
        </div>
      </div>

      {/* Price & Action - Sticky Footer */}
      <div className="mt-auto px-4 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
        <div>{renderPrice()}</div>
        <button
          onClick={() => onPurchase(listing)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition whitespace-nowrap"
        >
          <ShoppingCart size={14} />
          Buy
        </button>
      </div>
    </div>
  );
}
