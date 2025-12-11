import { SignOutButton } from "../auth/SignOutButton";
import { HeaderRightActions } from "./HeaderRightActions";
import { useState, useEffect, memo, useCallback, useRef, useMemo } from "react";
import { Menu, MapPin, ChevronDown, Loader2, Navigation, Search } from "lucide-react";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import { searchLocations, formatLocation, LocationData } from "../../lib/locationService";
import { debounce } from "../../lib/performanceUtils";

interface HeaderProps {
  sidebarCollapsed?: boolean;
  setSidebarCollapsed?: (collapsed: boolean) => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  user?: any;
  setShowAuthModal?: (show: boolean) => void;
  selectedLocation?: string;
  setSelectedLocation?: (location: string) => void;
  leftNode?: React.ReactNode;
  centerNode?: React.ReactNode;
  rightNode?: React.ReactNode;
}

// Location selector component
const LocationSelector = memo(function LocationSelector({ selectedLocation, setSelectedLocation, align = 'left' }: {
  selectedLocation: string;
  setSelectedLocation: (location: string) => void;
  align?: 'left' | 'right';
}) {
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const detectLocation = async () => {
    setIsDetectingLocation(true);

    if (!navigator.geolocation) {
      setSelectedLocation("");
      setIsDetectingLocation(false);
      setIsOpen(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // Use Nominatim (OpenStreetMap) reverse geocoding - free service
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            {
              headers: {
                'User-Agent': 'FlyerBoard/1.0' // Required by Nominatim usage policy
              }
            }
          );

          if (!response.ok) {
            throw new Error("Geocoding failed");
          }

          const data = await response.json();
          const address = data.address;

          // Extract suburb/locality and postcode
          const suburb = address.suburb || address.city || address.town || address.village || address.locality;
          const postcode = address.postcode;

          if (suburb && postcode) {
            // Search for matching location in Australian postcode database
            const results = await searchLocations(`${suburb} ${postcode}`);

            if (results.length > 0) {
              // Use the first (most relevant) match
              setSelectedLocation(formatLocation(results[0]));
              setIsDetectingLocation(false);
              setIsOpen(false);
              return;
            }
          }

          // Fallback: try searching by suburb name only
          if (suburb) {
            const results = await searchLocations(suburb);
            if (results.length > 0) {
              setSelectedLocation(formatLocation(results[0]));
              setIsDetectingLocation(false);
              setIsOpen(false);
              return;
            }
          }

          // If no match found, use a sensible default
          setSelectedLocation("");
        } catch (error) {
          console.error("Failed to detect location:", error);
          // Fallback to default
          setSelectedLocation("");
        } finally {
          setIsDetectingLocation(false);
          setIsOpen(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setSelectedLocation("");
        setIsDetectingLocation(false);
        setIsOpen(false);
      }
    );
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.location-dropdown')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      if (inputRef.current) {
        inputRef.current.focus();
      }
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  // Optimized location search with debouncing
  const debouncedSearch = useMemo(
    () => debounce(async (searchQuery: string) => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const results = await searchLocations(searchQuery);
          setSuggestions(results);
        } catch (error) {
          console.error("Failed to search locations", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSuggestions([]);
      }
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSearch(query);
    return () => { }; // Cleanup handled by debounce function
  }, [query]);

  return (
    <div className="relative location-dropdown">
      <button
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isDetectingLocation}
      >
        <MapPin className="w-4 h-4" />
        <span className="max-w-[150px] truncate">{selectedLocation || "All Locations"}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute top-full mt-1 w-72 max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-lg z-50 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter suburb or postcode..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {isSearching ? (
              <div className="px-4 py-2 text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </div>
            ) : suggestions.length > 0 ? (
              suggestions.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => {
                    setSelectedLocation(formatLocation(loc));
                    setIsOpen(false);
                    setQuery("");
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors flex flex-col"
                >
                  <span className="font-medium text-gray-900">{loc.locality}</span>
                  <span className="text-xs text-gray-500">{loc.state} {loc.postcode}</span>
                </button>
              ))
            ) : query.length >= 2 ? (
              <div className="px-4 py-2 text-sm text-gray-500">No locations found</div>
            ) : (
              <button
                onClick={() => {
                  setSelectedLocation("");
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
              >
                All Locations
              </button>
            )}
          </div>

          <div className="border-t border-gray-100 p-1">
            <button
              onClick={detectLocation}
              disabled={isDetectingLocation}
              className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-2"
            >
              {isDetectingLocation ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
              Detect my location
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// Mobile Header Component with expandable search
const MobileHeader = memo(function MobileHeader({
  sidebarCollapsed,
  setSidebarCollapsed,
  searchQuery,
  setSearchQuery,
  selectedLocation,
  setSelectedLocation,
  user,
  setShowAuthModal,
  navigate,
}: {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedLocation: string;
  setSelectedLocation: (location: string) => void;
  user: any;
  setShowAuthModal: (show: boolean) => void;
  navigate: (path: string) => void;
}) {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery || "");

  // Sync local state with prop when prop changes (e.g. clear search)
  useEffect(() => {
    setLocalSearchQuery(searchQuery || "");
  }, [searchQuery]);

  // Debounced search handler
  const debouncedSetSearchQuery = useMemo(
    () => debounce((value: string) => {
      setSearchQuery(value);
    }, 500),
    [setSearchQuery]
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalSearchQuery(newValue);
    debouncedSetSearchQuery(newValue);

    // Navigate to home if not already there and search is not empty
    if (newValue.trim() !== "" && window.location.pathname !== "/") {
      navigate('/');
    }
  }, [debouncedSetSearchQuery, navigate]);

  // Focus search input when expanded
  useEffect(() => {
    if (searchExpanded && searchInputRef.current) {
      // Small timeout to ensure element is rendered and transition started
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [searchExpanded]);

  // Close search on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Ignore if clicking the search toggle button (to prevent conflict with its onClick)
      if (target.closest('button[title="Search"]')) return;

      if (searchExpanded && !target.closest('.mobile-search-container')) {
        setSearchExpanded(false);
      }
    };

    if (searchExpanded) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [searchExpanded]);

  return (
    <>


      {/* Main Mobile Header Bar */}
      <div className="flex items-center justify-between h-14 px-4 gap-2">
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
            title={sidebarCollapsed ? "Open menu" : "Close menu"}
          >
            <Menu className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 cursor-pointer" onClick={() => navigate('/')}>
            {window.location.pathname === '/dashboard' ? 'My dashboard' : 'FlyerBoard'}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          {window.location.pathname === '/dashboard' ? (
            <SignOutButton onSignOut={() => navigate('/')} iconOnly />
          ) : (
            <>
              {/* Location Selector */}
              <div className="flex-shrink-1 min-w-0">
                <LocationSelector
                  selectedLocation={selectedLocation}
                  setSelectedLocation={setSelectedLocation}
                  align="right"
                />
              </div>

              {/* Search Icon Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchExpanded(!searchExpanded);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                title="Search"
              >
                <Search className="w-5 h-5 text-gray-700" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expandable Search Overlay */}
      {searchExpanded && (
        <div className="mobile-search-container border-t border-gray-100 bg-white px-4 py-3 animate-fade-in">
          <div className="space-y-3">
            <form className="relative" onSubmit={e => e.preventDefault()} autoComplete="off">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search in flyers..."
                value={localSearchQuery}
                onChange={handleSearchChange}
                className="w-full h-10 px-4 pl-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
              />
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none" />
            </form>
          </div>
        </div>
      )}
    </>
  );
});

export const Header = memo(function Header({
  sidebarCollapsed = false,
  setSidebarCollapsed = () => { },
  searchQuery = "",
  setSearchQuery = () => { },
  user,
  setShowAuthModal = () => { },
  selectedLocation = "",
  setSelectedLocation = () => { },
  leftNode,
  centerNode,
  rightNode,
}: HeaderProps) {
  const navigate = useNavigate();

  // Debounced search handler to prevent excessive re-renders
  const debouncedSetSearchQuery = useMemo(
    () => debounce((value: string) => {
      setSearchQuery(value);
    }, 500),
    [setSearchQuery]
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSetSearchQuery(e.target.value);

    // Navigate to home if not already there and search is not empty
    if (e.target.value.trim() !== "" && window.location.pathname !== "/") {
      navigate('/');
    }
  }, [debouncedSetSearchQuery, navigate]);

  return (
    <header className="sticky top-0 z-50 glass border-b border-neutral-200/50">
      <div className="max-w-[1440px] mx-auto">
        {/* Desktop Header */}
        <div className={`hidden md:flex items-center justify-between h-14 px-4 ${centerNode ? 'relative' : ''}`}>
          {/* Left section - Logo and Location */}
          <div className="flex items-center gap-6 flex-shrink-0">
            {leftNode ? leftNode : (
              <>
                <h1 className="text-xl font-bold text-gray-900 cursor-pointer" onClick={() => navigate('/')}>FlyerBoard</h1>

                {/* Location Selector - Divar style */}
                <LocationSelector
                  selectedLocation={selectedLocation}
                  setSelectedLocation={setSelectedLocation}
                />
              </>
            )}
          </div>

          {/* Center section - Search Bar */}
          <div className={centerNode ? "absolute left-1/2 -translate-x-1/2" : "flex-1 flex justify-center px-8"}>
            {centerNode ? centerNode : (
              <form className="relative w-full max-w-2xl" onSubmit={e => e.preventDefault()} autoComplete="off">
                <input
                  type="text"
                  placeholder="Search in flyers..."
                  defaultValue={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full h-10 px-4 pl-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                />
                <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </form>
            )}
          </div>

          {/* Right section - Actions */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {rightNode ? rightNode : (
              <HeaderRightActions
                user={user}
                onPostClick={() => {
                  if (user) {
                    navigate('/post', { state: { from: window.location.pathname } });
                  } else {
                    setShowAuthModal(true);
                  }
                }}
                onDashboardClick={() => navigate('/dashboard')}
                onSignInClick={() => setShowAuthModal(true)}
              />
            )}
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden">
          {leftNode || centerNode || rightNode ? (
            <div className="flex items-center justify-between h-14 px-4">
              <div className="flex items-center gap-3">
                {leftNode}
              </div>
              <div className="flex-1 flex justify-center px-2 min-w-0">
                {centerNode}
              </div>
              <div className="flex items-center gap-2">
                {rightNode}
              </div>
            </div>
          ) : (
            <MobileHeader
              sidebarCollapsed={sidebarCollapsed}
              setSidebarCollapsed={setSidebarCollapsed}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedLocation={selectedLocation}
              setSelectedLocation={setSelectedLocation}
              user={user}
              setShowAuthModal={setShowAuthModal}
              navigate={navigate}
            />
          )}
        </div>
      </div>
    </header>
  );
});
