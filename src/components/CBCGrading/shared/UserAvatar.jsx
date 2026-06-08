import React, { useState } from 'react';
import { cn } from '../../../utils/cn';

const UserAvatar = ({ name, imageUrl, size = 'md', className }) => {
  const [error, setError] = useState(false);

  const getInitials = (fullName) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const initials = getInitials(name);

  const sizeClasses = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-20 w-20 text-2xl',
  };

  const hasImage = imageUrl && !error;

  return (
    <div 
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full flex items-center justify-center font-bold tracking-tighter",
        !hasImage && "bg-brand-purple text-white border border-white/10",
        sizeClasses[size] || sizeClasses.md,
        className
      )}
    >
      {hasImage ? (
        <img
          src={imageUrl}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

export default UserAvatar;
