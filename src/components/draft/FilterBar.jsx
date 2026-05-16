export default function FilterBar({
  search, onSearch, searchRef,
  posFilter, onPosFilter,
  showAvailableOnly, onToggleAvailable,
  filterPositions,
}) {
  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-mono select-none">/</span>
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search players..."
          className="bg-bg border border-border rounded pl-7 pr-3 py-2 text-sm text-white w-52 focus:outline-none focus:border-pick placeholder-gray-600"
        />
      </div>

      <div className="flex gap-1.5">
        <FilterButton active={posFilter === null} onClick={() => onPosFilter(null)}>ALL</FilterButton>
        {filterPositions.map(pos => (
          <FilterButton
            key={pos}
            active={posFilter === pos}
            onClick={() => onPosFilter(posFilter === pos ? null : pos)}
          >
            {pos}
          </FilterButton>
        ))}
      </div>

      <div className="ml-auto">
        <FilterButton active={showAvailableOnly} onClick={onToggleAvailable}>
          {showAvailableOnly ? 'All Players' : 'Available'}
        </FilterButton>
      </div>
    </div>
  )
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
        active
          ? 'bg-pick text-white'
          : 'bg-bg border border-border text-gray-400 hover:border-pick hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  )
}
