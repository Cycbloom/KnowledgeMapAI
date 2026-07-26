import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DashboardPaginationProps {
  isDark: boolean;
  isMobile: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const DashboardPagination: React.FC<DashboardPaginationProps> = ({
  isDark,
  isMobile,
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

  return (
    <nav aria-label={t("common.aria.pagination")} className="flex items-center justify-center gap-2 sm:gap-3 mt-6 sm:mt-8">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        aria-label={t("common.aria.previousPage")}
        aria-disabled={currentPage === 1 ? "true" : undefined}
        className={`min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-2 rounded-xl transition-all flex items-center justify-center ${
          currentPage === 1
            ? "opacity-30 cursor-not-allowed"
            : isDark
              ? "hover:bg-slate-800 text-slate-300"
              : "hover:bg-gray-100 text-gray-600"
        }`}
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </button>

      {/* Desktop: Show page numbers */}
      {!isMobile && (
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(
            (page) => {
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    aria-current={currentPage === page ? "page" : undefined}
                    aria-label={t("common.aria.page", { number: page })}
                    className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                      currentPage === page
                        ? "bg-primary-600 text-white shadow-lg shadow-primary-600/20"
                        : isDark
                          ? "hover:bg-slate-800 text-slate-400"
                          : "hover:bg-gray-100 text-gray-500"
                    }`}
                  >
                    {page}
                  </button>
                );
              } else if (
                (page === currentPage - 2 && page > 1) ||
                (page === currentPage + 2 && page < totalPages)
              ) {
                return (
                  <span key={page} className="px-1 text-slate-400">
                    ...
                  </span>
                );
              }
              return null;
            },
          )}
        </div>
      )}

      {/* Mobile: Show current page text */}
      {isMobile && (
        <div
          className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-600"}`}
        >
          {currentPage} / {totalPages}
        </div>
      )}

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        aria-label={t("common.aria.nextPage")}
        aria-disabled={currentPage === totalPages ? "true" : undefined}
        className={`min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-2 rounded-xl transition-all flex items-center justify-center ${
          currentPage === totalPages
            ? "opacity-30 cursor-not-allowed"
            : isDark
              ? "hover:bg-slate-800 text-slate-300"
              : "hover:bg-gray-100 text-gray-600"
        }`}
      >
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </nav>
  );
};
