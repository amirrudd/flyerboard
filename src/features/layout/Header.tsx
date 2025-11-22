import { SignOutButton } from "../auth/SignOutButton";
import { HeaderRightActions } from "./HeaderRightActions";
import { useState, useEffect, memo, useCallback, useRef } from "react";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import { searchLocations, formatLocation, LocationData } from "../../lib/locationService";

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
const LocationSelector = memo(function LocationSelector({ selectedLocation, setSelectedLocation }: {
  selectedLocation: string;
  setSelectedLocation: (location: string) => void;
}) {
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const detectLocation = () => {
    setIsDetectingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          let detectedCity = "Melbourne, CBD"; // Default

          // Sydney area
          if (latitude > -34.5 && latitude < -33.5 && longitude > 150.5 && longitude < 151.5) {
            detectedCity = "Sydney, CBD";
          }
          // Melbourne area  
          else if (latitude > -38.5 && latitude < -37.5 && longitude > 144.5 && longitude < 145.5) {
            detectedCity = "Melbourne, CBD";
          }
          // Brisbane area
          else if (latitude > -28 && latitude < -27 && longitude > 152.5 && longitude < 153.5) {
            detectedCity = "Brisbane, South Bank";
          }
          // Perth area
          else if (latitude > -32.5 && latitude < -31.5 && longitude > 115.5 && longitude < 116.5) {
            detectedCity = "Perth, Fremantle";
          }

          setSelectedLocation(detectedCity);
          setIsDetectingLocation(false);
          setIsOpen(false);
        },
        () => {
          setSelectedLocation("Melbourne, CBD");
          setIsDetectingLocation(false);
          setIsOpen(false);
        }
      );
    } else {
      setSelectedLocation("Melbourne, CBD");
      setIsDetectingLocation(false);
      setIsOpen(false);
    }
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

  // Search locations
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length >= 2) {
        setIsSearching(true);
        try {
          const results = await searchLocations(query);
          setSuggestions(results);
        } catch (error) {
          console.error("Failed to search locations", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <div className="relative location-dropdown">
      <button
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isDetectingLocation}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="max-w-[150px] truncate">{selectedLocation || "All Locations"}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
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
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
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
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
              Detect my location
            </button>
          </div>
        </div>
      )}
    </div>
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

  return (
    <header className="sticky top-0 z-50 glass border-b border-neutral-200/50">
      <div className="max-w-[1440px] mx-auto">
        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between h-14 px-4">
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
          <div className="flex-1 flex justify-center px-8">
            {centerNode ? centerNode : (
              <form className="relative w-full max-w-2xl" onSubmit={e => e.preventDefault()} autoComplete="off">
                <input
                  type="text"
                  placeholder="Search in listings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                    navigate('/post');
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
          <div className="flex items-center justify-between h-14 px-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                title={sidebarCollapsed ? "Show filters" : "Hide filters"}
              >
                {sidebarCollapsed ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
              <h1 className="text-lg font-bold text-gray-900" onClick={() => navigate('/')}>FlyerBoard</h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (user) {
                    navigate('/post');
                  } else {
                    setShowAuthModal(true);
                  }
                }}
                className="h-9 px-3 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Post
              </button>
              {user ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-1 px-2 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Dashboard
                </button>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-1 px-2 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign In
                </button>
              )}
            </div>
          </div>

          {/* Mobile Search and Location */}
          <div className="px-4 pb-3 border-t border-gray-100">
            <div className="space-y-3">
              <form className="relative" onSubmit={e => e.preventDefault()} autoComplete="off">
                <input
                  type="text"
                  placeholder="Search in listings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 px-4 pl-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                />
                <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </form>

              {/* Mobile Location Selector */}
              <LocationSelector
                selectedLocation={selectedLocation}
                setSelectedLocation={setSelectedLocation}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
});
