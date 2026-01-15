import {
    Car,
    Home,
    Smartphone,
    Armchair,
    Wrench,
    Shirt,
    Dumbbell,
    Briefcase,
    Watch,
    Book,
    PawPrint,
    Palette,
    CalendarClock,
    Baby,
    Gamepad2,
    LayoutGrid,
    LucideIcon,
    // Additional icons for common categories
    Music,
    Camera,
    Utensils,
    Plane,
    Heart,
    Gift,
    ShoppingBag,
    Laptop,
    Headphones,
    Bike,
    Tv,
    Monitor,
    Scissors,
    Hammer,
    Coffee,
    Wine,
    Pizza,
    Apple,
    Flower2,
    TreePine,
    Sun,
    Moon,
    Cloud,
    Umbrella,
    Snowflake,
    Flame,
    Droplet,
    Mountain,
    Building2,
    Store,
    School,
    Hotel,
    Church,
    Landmark,
    Factory,
    Warehouse,
    Tent,
    Rocket,
    Anchor,
    Ship,
    Train,
    Bus,
    Truck,
    Tractor,
    Ambulance,
    Stethoscope,
    Pill,
    Syringe,
    Activity,
    Microscope,
    GraduationCap,
    BookOpen,
    Library,
    Newspaper,
    FileText,
    Folder,
    MessageCircle,
    Mail,
    Phone,
    Wifi,
    Bluetooth,
    Battery,
    Zap,
    Lightbulb,
    Cpu,
    HardDrive,
    Mouse,
    Keyboard,
    Printer,
    Speaker,
    Radio,
    Mic,
    Video,
    Film,
    Image,
    Brush,
    Pen,
    Edit3,
    Type,
    Glasses,
    Crown,
    Medal,
    Trophy,
    Target,
    Flag,
    Star,
    Sparkles,
    Diamond,
    Gem,
    Coins,
    Banknote,
    CreditCard,
    Receipt,
    ShoppingCart,
    Package,
    Box,
    Archive,
    Trash2,
    Recycle,
    Leaf,
    Sprout,
    Bug,
    Cat,
    Dog,
    Bird,
    Fish,
    Egg,
    Bone,
    Footprints,
    HandMetal,
    ThumbsUp,
    Users,
    UserCircle,
    PersonStanding,
    Smile,
    Frown,
    Angry,
    PartyPopper,
    Cake,
    IceCream,
    Cookie,
    Candy,
    Soup,
    Salad,
    Beef,
    Croissant,
    Beer,
    Martini,
    Cigarette,
    Pill as Medicine,
    Dna,
    Atom,
    Brain,
    Eye,
    Ear,
    Hand,
    Footprints as Feet,
    Bed,
    Sofa,
    Lamp,
    Fan,
    AirVent,
    Refrigerator,
    WashingMachine,
    Microwave,
    CookingPot,
    UtensilsCrossed,
    Timer,
    AlarmClock,
    Clock,
    Calendar,
    CalendarDays,
    Map,
    MapPin,
    Compass,
    Navigation,
    Route,
    Signpost,
    Globe,
    Languages,
    QrCode,
    Barcode,
    Scan,
    Search,
    Filter,
    SlidersHorizontal,
    Settings,
    Cog,
    Wrench as ToolIcon,
    Hammer as HammerIcon,
    Axe,
    Shovel,
    Paintbrush,
    PaintRoller,
    Ruler,
    Eraser,
    Paperclip,
    Link,
    Lock,
    Unlock,
    Key,
    Shield,
    ShieldCheck,
    Fingerprint,
} from "lucide-react";

const LUCIDE_CDN_BASE = "https://cdn.jsdelivr.net/npm/lucide-static@0.517.0";

/**
 * Convert PascalCase to kebab-case for CDN URLs
 */
function pascalToKebab(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
        .toLowerCase();
}

/**
 * Map of available icon names to Lucide components.
 * Icon names stored in DB should be PascalCase (e.g., "Car", "ShoppingBag").
 */
export const iconMap: Record<string, LucideIcon> = {
    // Core category icons
    Car, Home, Smartphone, Armchair, Wrench, Shirt, Dumbbell, Briefcase,
    Watch, Book, PawPrint, Palette, CalendarClock, Baby, Gamepad2, LayoutGrid,
    // Extended icons
    Music, Camera, Utensils, Plane, Heart, Gift, ShoppingBag, Laptop,
    Headphones, Bike, Tv, Monitor, Scissors, Hammer, Coffee, Wine, Pizza,
    Apple, Flower2, TreePine, Sun, Moon, Cloud, Umbrella, Snowflake, Flame,
    Droplet, Mountain, Building2, Store, School, Hotel, Church, Landmark,
    Factory, Warehouse, Tent, Rocket, Anchor, Ship, Train, Bus, Truck,
    Tractor, Ambulance, Stethoscope, Pill, Syringe, Activity, Microscope,
    GraduationCap, BookOpen, Library, Newspaper, FileText, Folder,
    MessageCircle, Mail, Phone, Wifi, Bluetooth, Battery, Zap, Lightbulb,
    Cpu, HardDrive, Mouse, Keyboard, Printer, Speaker, Radio, Mic, Video,
    Film, Image, Brush, Pen, Edit3, Type, Glasses, Crown, Medal, Trophy,
    Target, Flag, Star, Sparkles, Diamond, Gem, Coins, Banknote, CreditCard,
    Receipt, ShoppingCart, Package, Box, Archive, Trash2, Recycle, Leaf,
    Sprout, Bug, Cat, Dog, Bird, Fish, Egg, Bone, Footprints, HandMetal,
    ThumbsUp, Users, UserCircle, PersonStanding, Smile, Frown, Angry,
    PartyPopper, Cake, IceCream, Cookie, Candy, Soup, Salad, Beef, Croissant,
    Beer, Martini, Cigarette, Dna, Atom, Brain, Eye, Ear, Hand, Bed, Sofa,
    Lamp, Fan, AirVent, Refrigerator, WashingMachine, Microwave, CookingPot,
    UtensilsCrossed, Timer, AlarmClock, Clock, Calendar, CalendarDays, Map, MapPin,
    Compass, Navigation, Route, Signpost, Globe, Languages, QrCode, Barcode,
    Scan, Search, Filter, SlidersHorizontal, Settings, Cog, Axe,
    Shovel, Paintbrush, PaintRoller, Ruler, Eraser, Paperclip, Link, Lock, Unlock,
    Key, Shield, ShieldCheck, Fingerprint,
};

/**
 * List of available icon names for admin icon picker dropdown.
 */
export const AVAILABLE_ICONS = Object.keys(iconMap);

/**
 * Get category icon component from database icon name.
 * Falls back to LayoutGrid if icon is not found or not provided.
 * 
 * @param icon - Icon name from database (PascalCase, e.g., "Car", "ShoppingBag")
 * @returns Lucide icon component
 */
export const getCategoryIcon = (icon?: string): LucideIcon => {
    if (icon && iconMap[icon]) {
        return iconMap[icon];
    }
    return LayoutGrid;
};

/**
 * Check if an icon exists in the pre-imported map
 */
export const hasIcon = (icon: string): boolean => {
    return icon in iconMap;
};

/**
 * Get CDN URL for an icon SVG (for fallback rendering)
 * @param icon - Icon name in PascalCase
 */
export const getIconCdnUrl = (icon: string): string => {
    const kebabName = pascalToKebab(icon);
    return `${LUCIDE_CDN_BASE}/icons/${kebabName}.svg`;
};
