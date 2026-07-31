import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/utils';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  blurPlaceholder?: string;
  onLoad?: () => void;
  onError?: () => void;
  threshold?: number;
  rootMargin?: string;
  aspectRatio?: number;
  showSkeleton?: boolean;
}

const DEFAULT_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f1f5f9" width="400" height="300"/%3E%3C/svg%3E';

export const LazyImage: React.FC<LazyImageProps> = memo(({
  src,
  alt,
  className = '',
  placeholder = DEFAULT_PLACEHOLDER,
  blurPlaceholder,
  onLoad,
  onError,
  threshold = 0.1,
  rootMargin = '50px',
  aspectRatio,
  showSkeleton = true,
}) => {
  const { t } = useTranslation();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.disconnect();
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observerRef.current.observe(img);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [threshold, rootMargin]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  const containerStyle: React.CSSProperties = aspectRatio
    ? { aspectRatio: `${aspectRatio}` }
    : {};

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={containerStyle}
    >
      {showSkeleton && !isLoaded && !hasError && (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700"
          aria-hidden="true"
        />
      )}

      {blurPlaceholder && !isLoaded && !hasError && (
        <div
          className="absolute inset-0 filter blur-xl scale-110"
          style={{
            backgroundImage: `url(${blurPlaceholder})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          aria-hidden="true"
        />
      )}

      <img
        ref={imgRef}
        src={isInView && !hasError ? src : placeholder}
        alt={alt}
        className={cn(
          'w-full h-full object-cover',
          'transition-all duration-500 ease-out',
          isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105',
          hasError ? 'opacity-50 grayscale' : '',
        )}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        decoding="async"
      />

      {hasError && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-slate-800"
          aria-label={t('common.aria.imageLoadFailed')}
        >
          <svg
            className="w-12 h-12 text-gray-400 dark:text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
    </div>
  );
});

LazyImage.displayName = 'LazyImage';

interface LazyBackgroundProps {
  src: string;
  children: React.ReactNode;
  className?: string;
  placeholder?: string;
  blurPlaceholder?: string;
  threshold?: number;
  rootMargin?: string;
}

export const LazyBackground: React.FC<LazyBackgroundProps> = memo(({
  src,
  children,
  className = '',
  placeholder = '',
  blurPlaceholder,
  threshold = 0.1,
  rootMargin = '50px',
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.disconnect();
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observerRef.current.observe(container);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [threshold, rootMargin]);

  useEffect(() => {
    if (!isInView || !src) return;

    const img = new Image();
    img.src = src;
    img.onload = () => setIsLoaded(true);
    img.onerror = () => setIsLoaded(false);
  }, [isInView, src]);

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden', className)}
    >
      {blurPlaceholder && !isLoaded && (
        <div
          className="absolute inset-0 filter blur-xl scale-110"
          style={{
            backgroundImage: `url(${blurPlaceholder})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          aria-hidden="true"
        />
      )}

      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          backgroundImage: isLoaded ? `url(${src})` : placeholder ? `url(${placeholder})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: isLoaded ? 1 : 0.5,
        }}
        aria-hidden="true"
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
});

LazyBackground.displayName = 'LazyBackground';
