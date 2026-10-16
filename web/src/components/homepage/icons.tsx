import {
  Award, BadgeCheck, BarChart3, Briefcase, Building, Building2, Calendar, Car, CheckCircle2, ChefHat,
  Clock, Compass, Cpu, Crown, Eye, Factory, FileCheck2, FileText, FileUp, Flame, Gem, Globe2,
  GraduationCap, Handshake, HardHat, HeartHandshake, HelpCircle, Hotel, Landmark, LayoutPanelLeft,
  Leaf, LineChart, Lock, Mail, MapPin, Megaphone, MessageSquareQuote, Monitor, Newspaper, Phone,
  PieChart, Plane, Quote, RectangleHorizontal, Rocket, Route, Scale, ScanLine, Search, Ship,
  ShieldCheck, ShoppingBag, Sparkles, Star, Stethoscope, Sun, Target, TrendingUp, Truck, UploadCloud,
  UserCheck, UserPlus, Users, Wallet, Wrench, Zap,
  Bus, Home, Cog, Store, HeartPulse, Construction, Trophy, Stamp, LayoutGrid, MoreHorizontal, Earth, BookUser, Ticket, PlaneTakeoff, Settings, UserCog,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icons the Website Builder offers. Stored config refers to them by name, so a
 * name must never be removed from this map once it may have been saved.
 */
export const ICONS: Record<string, LucideIcon> = {
  Award, BadgeCheck, BarChart3, Briefcase, Building, Building2, Calendar, Car, CheckCircle2, ChefHat,
  Clock, Compass, Cpu, Crown, Eye, Factory, FileCheck2, FileText, FileUp, Flame, Gem, Globe2,
  GraduationCap, Handshake, HardHat, HeartHandshake, HelpCircle, Hotel, Landmark, LayoutPanelLeft,
  Leaf, LineChart, Lock, Mail, MapPin, Megaphone, MessageSquareQuote, Monitor, Newspaper, Phone,
  PieChart, Plane, Quote, RectangleHorizontal, Rocket, Route, Scale, ScanLine, Search, Ship,
  ShieldCheck, ShoppingBag, Sparkles, Star, Stethoscope, Sun, Target, TrendingUp, Truck, UploadCloud,
  UserCheck, UserPlus, Users, Wallet, Wrench, Zap,
  Bus, Home, Cog, Store, HeartPulse, Construction, Trophy, Stamp, LayoutGrid, MoreHorizontal, Earth, BookUser, Ticket, PlaneTakeoff, Settings, UserCog,
};

export const ICON_NAMES = Object.keys(ICONS).sort();

export function Icon({ name, fallback = 'Sparkles', ...props }: { name?: string; fallback?: string } & React.ComponentProps<LucideIcon>) {
  const Cmp = (name && ICONS[name]) || ICONS[fallback] || Sparkles;
  return <Cmp {...props} />;
}
