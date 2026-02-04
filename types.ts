
export type UserRole = 'user' | 'trainer';

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  role: UserRole;
  isEnrolled: boolean;
  enrolledPackages: Package[];
}

export interface Package {
  id: string;
  category: 'fitness' | 'nutrition';
  name: string;
  description: string;
  price: number;
}

export type View = 
  | 'splash' 
  | 'login' 
  | 'trainerLogin' 
  | 'signup' 
  | 'enrollChoice' 
  | 'packages' 
  | 'payment' 
  | 'home' 
  | 'calorie' 
  | 'period' 
  | 'mood' 
  | 'attendance'
  | 'profile'
  | 'settings'
  | 'accountDetails'
  | 'notifications'
  | 'theme'
  | 'privacy';

export interface FoodLog {
  id: string;
  date: string;
  name: string;
  calories: number;
  macros: { protein: number; carbs: number; fat: number };
  unit: 'g' | 'ml' | 'oz';
  amount: number;
}

export interface MoodLog {
  id: string;
  date: string;
  rating: number; // 1-5
  note: string;
  tags?: string[];
}

export interface CycleLog {
  id: string;
  date: string;
  symptoms: string[];
  flow: 'none' | 'light' | 'medium' | 'heavy';
}
