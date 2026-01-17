// src/components/admin/common/Pagination.jsx
// Page navigation component - Arrakis Labs Dune theme

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  showItemCount = true,
  showPageNumbers = true,
  maxPageButtons = 5,
}) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Calculate page numbers to show
  const getPageNumbers = () => {
    if (totalPages <= maxPageButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const halfMax = Math.floor(maxPageButtons / 2);
    let start = Math.max(1, currentPage - halfMax);
    let end = Math.min(totalPages, start + maxPageButtons - 1);

    if (end - start < maxPageButtons - 1) {
      start = Math.max(1, end - maxPageButtons + 1);
    }

    const pages = [];
    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push("...");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-between py-4">
      {/* Item count */}
      {showItemCount && (
        <p
          className="text-[#78716C] text-xs uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Showing {startItem}-{endItem} of {totalItems}
        </p>
      )}

      {/* Page controls */}
      <div className="flex items-center gap-1">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 border border-[#1A1814] text-[#78716C] 
                     hover:text-[#E8E4D9] hover:border-[#78716C] 
                     disabled:opacity-30 disabled:cursor-not-allowed
                     transition-colors duration-200 text-xs uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          ← Prev
        </button>

        {/* Page numbers */}
        {showPageNumbers && (
          <div className="flex items-center gap-1 mx-2">
            {pageNumbers.map((page, idx) =>
              page === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1.5 text-[#78716C] text-xs"
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`w-8 h-8 flex items-center justify-center text-xs
                              transition-colors duration-200 ${
                                currentPage === page
                                  ? "bg-[#1A1814] text-[#F59E0B] border border-[#F59E0B]/30"
                                  : "text-[#78716C] hover:text-[#E8E4D9] border border-transparent hover:border-[#1A1814]"
                              }`}
                  style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
                >
                  {page}
                </button>
              ),
            )}
          </div>
        )}

        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 border border-[#1A1814] text-[#78716C] 
                     hover:text-[#E8E4D9] hover:border-[#78716C] 
                     disabled:opacity-30 disabled:cursor-not-allowed
                     transition-colors duration-200 text-xs uppercase tracking-wider"
          style={{ fontFamily: "'Rajdhani', system-ui, sans-serif" }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
