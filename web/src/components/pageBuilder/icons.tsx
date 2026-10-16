import {
  Activity, AlarmClock, AlertCircle, AlertTriangle, Anchor, Aperture, Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight,
  AtSign, Award, Baby, BadgeCheck, BadgeDollarSign, BadgePercent, Banknote, BarChart, BarChart2, BarChart3, BarChartHorizontal, Bath,
  Battery, Bed, Bell, Bike, Bolt, Book, BookOpen, BookUser, Bookmark, Bot, Box, BoxSelect, Boxes, Brain, Briefcase, Brush, Bug,
  Building, Building2, Bus, Cake, Calculator, Calendar, CalendarCheck, CalendarDays, Camera, Car, Check, CheckCircle, CheckCircle2,
  CheckSquare, ChefHat, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, CircleDollarSign, Clipboard, ClipboardCheck,
  ClipboardList, Clock, Cloud, Code, Code2, Coffee, Cog, Coins, Columns2, Compass, Construction, Contact, Copy, Cpu, CreditCard, Crown,
  Database, Diamond, DollarSign, Download, Droplet, Dumbbell, Earth, Eye, Facebook, Factory, Feather, File, FileCheck, FileCheck2,
  FileText, FileUp, Film, Filter, Fingerprint, Flag, Flame, FlaskConical, Flower, Fuel, Gauge, Gem, Gift, Globe, Globe2, GraduationCap,
  Grid3x3, Hammer, Hand, HandCoins, HandHeart, Handshake, HardHat, Hash, Headphones, Headset, Heart, HeartHandshake, HeartPulse,
  HelpCircle, Home, Hotel, Hourglass, Image, Inbox, Info, Instagram, Key, KeyRound, Landmark, Languages, Laptop, Layers, Layout,
  LayoutDashboard, LayoutGrid, LayoutPanelLeft, Leaf, Lightbulb, LineChart, Link, Linkedin, List, ListChecks, Lock, LogIn, Mail,
  MailOpen, Map, MapPin, Medal, Megaphone, MessageCircle, MessageSquare, MessageSquareQuote, Mic, Milestone, Minus, Monitor, Moon,
  MoreHorizontal, Mountain, MousePointer, Music, Navigation, Newspaper, Package, Paintbrush, Palette, Paperclip, PartyPopper, Pen,
  PenTool, Percent, Phone, PhoneCall, PieChart, PiggyBank, Pill, Pin, Plane, PlaneTakeoff, Play, PlayCircle, Plug, Plus, Pocket,
  Printer, Puzzle, QrCode, Quote, Radio, Receipt, RectangleHorizontal, Recycle, RefreshCw, Repeat, Rocket, Route, Ruler, ScanLine,
  School, Scissors, Search, Send, Server, Settings, Share2, Shield, ShieldCheck, Ship, ShoppingBag, ShoppingCart, Smartphone, Smile,
  Sparkle, Sparkles, Speaker, Square, Stamp, Star, Stethoscope, Store, Sun, Sunrise, Syringe, Table, Tag, Target, Tent, Terminal,
  ThumbsUp, Ticket, Timer, ToggleRight, Train, TrendingUp, Trophy, Truck, Tv, Twitter, Umbrella, Upload, UploadCloud, User, UserCheck,
  UserCog, UserPlus, UserRound, Users, UsersRound, Utensils, Video, Wallet, Wand2, Warehouse, Watch, Wifi, Wind, Wine, Workflow,
  Wrench, X, Youtube, Zap, ZoomIn,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icons offered by the page builder. Saved pages refer to them by name, so a
 * name must never be removed once it may have been used.
 */
export const PB_ICONS: Record<string, LucideIcon> = {
  Activity, AlarmClock, AlertCircle, AlertTriangle, Anchor, Aperture, Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight,
  AtSign, Award, Baby, BadgeCheck, BadgeDollarSign, BadgePercent, Banknote, BarChart, BarChart2, BarChart3, BarChartHorizontal, Bath,
  Battery, Bed, Bell, Bike, Bolt, Book, BookOpen, BookUser, Bookmark, Bot, Box, BoxSelect, Boxes, Brain, Briefcase, Brush, Bug,
  Building, Building2, Bus, Cake, Calculator, Calendar, CalendarCheck, CalendarDays, Camera, Car, Check, CheckCircle, CheckCircle2,
  CheckSquare, ChefHat, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, CircleDollarSign, Clipboard, ClipboardCheck,
  ClipboardList, Clock, Cloud, Code, Code2, Coffee, Cog, Coins, Columns2, Compass, Construction, Contact, Copy, Cpu, CreditCard, Crown,
  Database, Diamond, DollarSign, Download, Droplet, Dumbbell, Earth, Eye, Facebook, Factory, Feather, File, FileCheck, FileCheck2,
  FileText, FileUp, Film, Filter, Fingerprint, Flag, Flame, FlaskConical, Flower, Fuel, Gauge, Gem, Gift, Globe, Globe2, GraduationCap,
  Grid3x3, Hammer, Hand, HandCoins, HandHeart, Handshake, HardHat, Hash, Headphones, Headset, Heart, HeartHandshake, HeartPulse,
  HelpCircle, Home, Hotel, Hourglass, Image, Inbox, Info, Instagram, Key, KeyRound, Landmark, Languages, Laptop, Layers, Layout,
  LayoutDashboard, LayoutGrid, LayoutPanelLeft, Leaf, Lightbulb, LineChart, Link, Linkedin, List, ListChecks, Lock, LogIn, Mail,
  MailOpen, Map, MapPin, Medal, Megaphone, MessageCircle, MessageSquare, MessageSquareQuote, Mic, Milestone, Minus, Monitor, Moon,
  MoreHorizontal, Mountain, MousePointer, Music, Navigation, Newspaper, Package, Paintbrush, Palette, Paperclip, PartyPopper, Pen,
  PenTool, Percent, Phone, PhoneCall, PieChart, PiggyBank, Pill, Pin, Plane, PlaneTakeoff, Play, PlayCircle, Plug, Plus, Pocket,
  Printer, Puzzle, QrCode, Quote, Radio, Receipt, RectangleHorizontal, Recycle, RefreshCw, Repeat, Rocket, Route, Ruler, ScanLine,
  School, Scissors, Search, Send, Server, Settings, Share2, Shield, ShieldCheck, Ship, ShoppingBag, ShoppingCart, Smartphone, Smile,
  Sparkle, Sparkles, Speaker, Square, Stamp, Star, Stethoscope, Store, Sun, Sunrise, Syringe, Table, Tag, Target, Tent, Terminal,
  ThumbsUp, Ticket, Timer, ToggleRight, Train, TrendingUp, Trophy, Truck, Tv, Twitter, Umbrella, Upload, UploadCloud, User, UserCheck,
  UserCog, UserPlus, UserRound, Users, UsersRound, Utensils, Video, Wallet, Wand2, Warehouse, Watch, Wifi, Wind, Wine, Workflow,
  Wrench, X, Youtube, Zap, ZoomIn,
};

export const PB_ICON_NAMES = Object.keys(PB_ICONS).sort();

export function PBIcon({ name, fallback, ...props }: { name?: string; fallback?: string } & React.ComponentProps<LucideIcon>) {
  const C = (name && PB_ICONS[name]) || (fallback ? PB_ICONS[fallback] : undefined);
  return C ? <C aria-hidden {...props} /> : null;
}
