import { SignOutButton } from "../auth/SignOutButton";
import { HeaderRightActions } from "./HeaderRightActions";
import { useState, useEffect, memo, useCallback, useRef, useMemo } from "react";
import { List, MapPin, CaretDown, CircleNotch, NavigationArrow, MagnifyingGlass } from "@phosphor-icons/react";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import { useSession } from "@descope/react-sdk";
import { ThemeToggle } from "../../components/ThemeToggle";
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
const LocationSelector = memo(function LocationSelector({ selectedLocation, setSelectedLocation, align = 'left', compact = false }: {
  selectedLocation: string;
  setSelectedLocation: (location: string) => void;
  align?: 'left' | 'right';
  compact?: boolean;
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
        className={compact
          ? "w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted active:scale-95 transition-all duration-150 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          : "group flex items-center gap-2 pl-2.5 pr-2 py-1.5 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors rounded-full ring-1 ring-border hover:ring-foreground/20 bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        }
        onClick={() => setIsOpen(!isOpen)}
        disabled={isDetectingLocation}
        title={compact ? (selectedLocation || "All Locations") : undefined}
      >
        <MapPin className={compact ? "w-5 h-5 text-foreground/70" : "w-4 h-4 text-primary"} />
        {!compact && (
          <>
            <span className="max-w-[150px] truncate">{selectedLocation || "All Locations"}</span>
            <CaretDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} weight="bold" />
          </>
        )}
      </button>

      {isOpen && (
        <div className={`absolute top-full mt-2 w-80 max-w-[90vw] bg-popover ring-1 ring-border rounded-xl shadow-card-hover z-50 overflow-hidden ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <div className="p-2.5 border-b border-border/70">
            <input
              ref={inputRef}
              type="text"
              placeholder="Enter suburb or postcode…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-muted/50 ring-1 ring-transparent focus:ring-ring focus:bg-background focus:outline-none transition-all placeholder:text-muted-foreground/70 text-foreground"
            />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {isSearching ? (
              <div className="px-4 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <CircleNotch className="w-4 h-4 animate-spin" />
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
                  className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors flex flex-col"
                >
                  <span className="font-medium text-foreground">{loc.locality}</span>
                  <span className="text-xs text-muted-foreground">{loc.state} {loc.postcode}</span>
                </button>
              ))
            ) : query.length >= 2 ? (
              <div className="px-4 py-2 text-sm text-muted-foreground">No locations found</div>
            ) : (
              <button
                onClick={() => {
                  setSelectedLocation("");
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
              >
                All Locations
              </button>
            )}
          </div>

          <div className="border-t border-border p-1">
            <button
              onClick={detectLocation}
              disabled={isDetectingLocation}
              className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-md transition-colors flex items-center gap-2"
            >
              {isDetectingLocation ? (
                <CircleNotch className="w-4 h-4 animate-spin" />
              ) : (
                <NavigationArrow className="w-4 h-4" />
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
      <div className="flex items-center justify-between h-14 container-padding gap-2">
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
            title={sidebarCollapsed ? "Open menu" : "Close menu"}
          >
            <List className="w-6 h-6 text-foreground/70" />
          </button>
          <button
            type="button"
            className="cursor-pointer flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
            onClick={() => navigate('/')}
            aria-label="FlyerBoard home"
          >
            <img src="/icons/icon-48x48.png" alt="" aria-hidden="true" className="w-7 h-7" />
            <span className="font-display text-lg font-semibold text-foreground tracking-[-0.02em] truncate">
              {window.location.pathname === '/dashboard' ? 'My dashboard' : 'FlyerBoard'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
          <ThemeToggle />
          {window.location.pathname === '/dashboard' ? (
            <SignOutButton onSignOut={() => navigate('/')} iconOnly />
          ) : (
            <>
              {/* Location Selector */}
              <div className="flex-shrink-0">
                <LocationSelector
                  selectedLocation={selectedLocation}
                  setSelectedLocation={setSelectedLocation}
                  align="right"
                  compact={true}
                />
              </div>

              {/* Search Icon Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchExpanded(!searchExpanded);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                title="Search"
              >
                <MagnifyingGlass className="w-5 h-5 text-foreground/70" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expandable Search Overlay */}
      {searchExpanded && (
        <div className="mobile-search-container border-t border-border/70 bg-background container-padding py-3 animate-fade-in">
          <form className="relative group" onSubmit={e => e.preventDefault()} autoComplete="off">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search the board…"
              value={localSearchQuery}
              onChange={handleSearchChange}
              className="w-full h-11 pl-11 pr-4 text-sm bg-muted/60 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all placeholder:text-muted-foreground/70 text-foreground"
            />
            <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors pointer-events-none" weight="bold" />
          </form>
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
  const { isAuthenticated } = useSession();

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
    <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border/70 h-[57px]">
      <div className="content-max-width mx-auto">
        {/* Desktop Header */}
        <div className={`hidden md:flex items-center justify-between h-14 container-padding ${centerNode ? 'relative' : ''}`}>
          {/* Left section - Logo and Location */}
          <div className="flex items-center gap-6 flex-shrink-0">
            {leftNode ? leftNode : (
              <>
                <button
                  type="button"
                  className="cursor-pointer flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full"
                  onClick={() => navigate('/')}
                  aria-label="FlyerBoard home"
                >
                  <img src="/icons/icon-48x48.png" alt="" aria-hidden="true" className="w-7 h-7 transition-transform duration-300 group-hover:rotate-[-4deg]" />
                  <span className="font-display text-[22px] font-semibold text-foreground tracking-[-0.02em] leading-none">
                    FlyerBoard
                  </span>
                </button>

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
              <form className="relative w-full max-w-2xl group" onSubmit={e => e.preventDefault()} autoComplete="off">
                <input
                  type="text"
                  placeholder="Search in flyers..."
                  defaultValue={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full h-10 pl-10 pr-4 text-sm bg-muted/50 rounded-full ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all placeholder:text-muted-foreground/70 text-foreground"
                />
                <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary transition-colors pointer-events-none" weight="bold" />
              </form>
            )}
          </div>

          {/* Right section - Actions. When a consumer supplies rightNode
              they take full control (and are expected to include
              ThemeToggle themselves if needed), otherwise we render the
              default ThemeToggle + HeaderRightActions. */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {rightNode ? rightNode : (
              <>
                <ThemeToggle />
                <HeaderRightActions
                  user={user}
                  isAuthenticated={isAuthenticated}
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
              </>
            )}
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden">
          {leftNode || centerNode || rightNode ? (
            <div className="flex items-center justify-between h-14 container-padding">
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
