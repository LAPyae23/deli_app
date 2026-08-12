'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  User, Store, Bike, ShieldCheck, Eye, EyeOff,
  ChevronRight, Copy, Check, Zap, Clock, Star, TrendingUp,
} from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';

type UserRole = 'CUSTOMER' | 'RESTAURANT' | 'RIDER' | 'ADMIN';
type AuthTab = 'login' | 'signup';

interface LoginForm { email: string; password: string; rememberMe: boolean; }
interface SignupForm { firstName: string; lastName: string; email: string; phone: string; password: string; confirmPassword: string; agreeTerms: boolean; }

const ROLE_CONFIG = {
  CUSTOMER: {
    label: 'Customer',
    icon: User,
    color: 'text-customer',
    bg: 'bg-orange-50',
    activeBg: 'bg-customer',
    border: 'border-customer',
    description: 'Order food from your favourite restaurants',
    route: '/customer-dashboard',
  },
  RESTAURANT: {
    label: 'Restaurant',
    icon: Store,
    color: 'text-restaurant',
    bg: 'bg-teal-50',
    activeBg: 'bg-restaurant',
    border: 'border-restaurant',
    description: 'Manage orders, menu & daily revenue',
    route: '/restaurant-vendor-portal',
  },
  RIDER: {
    label: 'Rider',
    icon: Bike,
    color: 'text-rider',
    bg: 'bg-indigo-50',
    activeBg: 'bg-rider',
    border: 'border-rider',
    description: 'Accept deliveries & track earnings',
    route: '/rider-fleet-dashboard',
  },
  ADMIN: {
    label: 'Admin',
    icon: ShieldCheck,
    color: 'text-admin',
    bg: 'bg-violet-50',
    activeBg: 'bg-admin',
    border: 'border-admin',
    description: 'Manage the entire platform & operations',
    route: '/super-admin-management-terminal',
  },
} as const;

const DEMO_CREDENTIALS = [
  { role: 'CUSTOMER' as UserRole, email: 'customer.bahan.1@test.com', password: 'Test@2026', name: 'Bahan Customer' },
  { role: 'RESTAURANT' as UserRole, email: 'restaurant.bahan.1@test.com', password: 'Test@2026', name: 'Bahan Inya Lake Cafe' },
  { role: 'RIDER' as UserRole, email: 'rider.bahan.1@test.com', password: 'Test@2026', name: 'Bahan Rider (Online)' },
  { role: 'ADMIN' as UserRole, email: 'ops.admin@fooddash.app', password: 'Admin#2026', name: 'Platform Admin' },
];

export default function AuthPageClient() {
  const router = useRouter();
  const [activeRole, setActiveRole] = useState<UserRole>('CUSTOMER');
  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loginForm = useForm<LoginForm>({ defaultValues: { email: '', password: '', rememberMe: false } });
  const signupForm = useForm<SignupForm>({ defaultValues: { firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '', agreeTerms: false } });

  const handleCopy = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const autofillCredentials = (cred: typeof DEMO_CREDENTIALS[0]) => {
    setActiveRole(cred.role);
    setActiveTab('login');
    loginForm.setValue('email', cred.email);
    loginForm.setValue('password', cred.password);
    toast.success(`Credentials filled for ${cred.name}`);
  };

  const onLoginSubmit = async (data: LoginForm) => {
  setIsLoading(true);

  try {
    // API သို့ Login Data များ ပို့လွှတ်ခြင်း
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        role: activeRole, // ဥပမာ - 'RESTAURANT', 'CUSTOMER' စသည်
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      // API ကနေ Error ပြန်လာရင် Form မှာ Error ပြပါမယ်
      loginForm.setError('email', { message: result.message || 'Invalid credentials' });
      setIsLoading(false);
      return;
    }

    const sessionId = result.userId || result.user?._id || data.email;
    const sessionName =
      result.user?.name ||
      result.name ||
      [result.user?.firstName, result.user?.lastName].filter(Boolean).join(' ') ||
      data.email;

    localStorage.setItem('fooddash_session_id', sessionId);
    localStorage.setItem('fooddash_session_name', sessionName);
    localStorage.setItem('fooddash_session_email', data.email);
    if (result.user?.role || activeRole) {
      localStorage.setItem('fooddash_session_role', result.user?.role || activeRole);
    }

    // Login အောင်မြင်ပါက Toast ပြပြီး သက်ဆိုင်ရာ Dashboard ကို သွားပါမယ်
    toast.success(result.message);
    setIsLoading(false);
    
    // Role အလိုက် သတ်မှတ်ထားတဲ့ Route ကို Redirect လုပ်ပါမယ်
    router.push(ROLE_CONFIG[activeRole].route);

  } catch (error: any) {
    toast.error('Something went wrong. Please try again.');
    setIsLoading(false);
  }
};
const onSignupSubmit = async (data: SignupForm) => {
  if (data.password !== data.confirmPassword) {
    signupForm.setError('confirmPassword', { message: 'Passwords do not match' });
    return;
  }
  
  setIsLoading(true);

  try {
    // API သို့ Data များ ပို့လွှတ်ခြင်း
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: activeRole, // ဥပမာ - 'RESTAURANT'
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Registration failed');
    }

    const sessionId = result.userId || result.user?._id || data.email;
    const sessionName =
      result.user?.name ||
      [data.firstName, data.lastName].filter(Boolean).join(' ') ||
      data.email;

    localStorage.setItem('fooddash_session_id', sessionId);
    localStorage.setItem('fooddash_session_name', sessionName);
    localStorage.setItem('fooddash_session_email', data.email);
    localStorage.setItem('fooddash_session_role', activeRole);

    toast.success('Account created! Please sign in.');
    setActiveTab('login');
  } catch (error: any) {
    toast.error(error.message);
  } finally {
    setIsLoading(false);
  }
};

  const cfg = ROLE_CONFIG[activeRole];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col relative overflow-hidden bg-foreground text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, var(--primary) 0%, transparent 60%), radial-gradient(circle at 80% 20%, var(--accent) 0%, transparent 50%)' }} />
        <div className="relative z-10 flex flex-col h-full p-10">
          <div className="flex items-center gap-3 mb-16">
            <AppLogo size={40} />
            <span className="text-2xl font-bold tracking-tight">FoodDash</span>
          </div>
          <div className="flex-1">
            <h1 className="text-4xl font-bold leading-tight mb-4">
              Powering food delivery<br />
              <span className="text-primary">across every role.</span>
            </h1>
            <p className="text-white/60 text-lg mb-12">
              One platform. Four dashboards. Real-time order intelligence from kitchen to doorstep.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-12">
              {[
                { icon: Zap, label: 'Real-time Orders', value: 'Live updates' },
                { icon: Clock, label: 'Avg Delivery', value: '28 minutes' },
                { icon: Star, label: 'Platform Rating', value: '4.8 / 5.0' },
                { icon: TrendingUp, label: "Today's GMV", value: '176.8M Ks' },
              ].map((stat) => (
                <div key={`stat-${stat.label}`} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <stat.icon className="w-5 h-5 text-primary mb-2" />
                  <p className="text-xs text-white/50 mb-0.5">{stat.label}</p>
                  <p className="text-base font-bold font-tabular">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-white/30 text-sm">© 2026 FoodDash Platform Inc. All rights reserved.</p>
        </div>
      </div>

      {/* Right Auth Panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <AppLogo size={32} />
            <span className="text-xl font-bold">FoodDash</span>
          </div>

          {/* Role Selector */}
          <div className="mb-6">
            <p className="section-label mb-3">I am a</p>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(ROLE_CONFIG) as UserRole[]).map((role) => {
                const rc = ROLE_CONFIG[role];
                const isActive = activeRole === role;
                return (
                  <button
                    key={`role-${role}`}
                    onClick={() => setActiveRole(role)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 ${
                      isActive
                        ? `${rc.border} bg-card shadow-md`
                        : 'border-border bg-card hover:border-border hover:bg-muted'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? rc.activeBg : rc.bg}`}>
                      <rc.icon className={`w-4 h-4 ${isActive ? 'text-white' : rc.color}`} />
                    </div>
                    <span className={`text-xs font-semibold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {rc.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">{cfg.description}</p>
          </div>

          {/* Auth Tabs */}
          <div className="flex bg-muted rounded-lg p-1 mb-6">
            {(['login', 'signup'] as AuthTab[]).map((tab) => (
              <button
                key={`tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 ${
                  activeTab === tab ? 'bg-card text-foreground card-shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Login Form */}
          {activeTab === 'login' && (
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Email Address</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="you@example.com"
                  {...loginForm.register('email', { required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' } })}
                />
                {loginForm.formState.errors.email && (
                  <p className="text-xs text-danger mt-1">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field pr-10"
                    placeholder="Enter your password"
                    {...loginForm.register('password', { required: 'Password is required', minLength: { value: 6, message: 'Minimum 6 characters' } })}
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-xs text-danger mt-1">{loginForm.formState.errors.password.message}</p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-border accent-primary" {...loginForm.register('rememberMe')} />
                  <span className="text-sm text-muted-foreground">Remember me</span>
                </label>
                <button type="button" className="text-sm font-semibold text-primary hover:underline">Forgot password?</button>
              </div>
              <button type="submit" disabled={isLoading} className="btn-primary w-full py-3">
                {isLoading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2 justify-center">
                    Sign In as {cfg.label} <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            </form>
          )}

          {/* Signup Form */}
          {activeTab === 'signup' && (
            <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">First Name</label>
                  <input type="text" className="input-field" placeholder="Maya" {...signupForm.register('firstName', { required: 'Required' })} />
                  {signupForm.formState.errors.firstName && <p className="text-xs text-danger mt-1">{signupForm.formState.errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Last Name</label>
                  <input type="text" className="input-field" placeholder="Chen" {...signupForm.register('lastName', { required: 'Required' })} />
                  {signupForm.formState.errors.lastName && <p className="text-xs text-danger mt-1">{signupForm.formState.errors.lastName.message}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Email Address</label>
                <input type="email" className="input-field" placeholder="you@example.com" {...signupForm.register('email', { required: 'Required' })} />
                {signupForm.formState.errors.email && <p className="text-xs text-danger mt-1">{signupForm.formState.errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Phone Number</label>
                <input type="tel" className="input-field" placeholder="+1 (555) 000-0000" {...signupForm.register('phone', { required: 'Required' })} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field pr-10"
                    placeholder="Min. 8 chars · Aa1@"
                    {...signupForm.register('password', {
                      required: 'Required',
                      minLength: { value: 8, message: 'Minimum 8 characters' },
                      pattern: {
                        value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
                        message: 'Must include uppercase, lowercase, number, and special character',
                      },
                    })}
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {signupForm.formState.errors.password && <p className="text-xs text-danger mt-1">{signupForm.formState.errors.password.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input type={showConfirmPassword ? 'text' : 'password'} className="input-field pr-10" placeholder="Repeat password" {...signupForm.register('confirmPassword', { required: 'Required' })} />
                  <button type="button" onClick={() => setShowConfirmPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {signupForm.formState.errors.confirmPassword && <p className="text-xs text-danger mt-1">{signupForm.formState.errors.confirmPassword.message}</p>}
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 mt-0.5 rounded border-border accent-primary" {...signupForm.register('agreeTerms', { required: 'You must agree to continue' })} />
                <span className="text-sm text-muted-foreground">
                  I agree to the <button type="button" className="text-primary font-semibold hover:underline">Terms of Service</button> and <button type="button" className="text-primary font-semibold hover:underline">Privacy Policy</button>
                </span>
              </label>
              {signupForm.formState.errors.agreeTerms && <p className="text-xs text-danger">{signupForm.formState.errors.agreeTerms.message}</p>}
              <button type="submit" disabled={isLoading} className="btn-primary w-full py-3">
                {isLoading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Creating account...
                  </span>
                ) : `Create ${cfg.label} Account`}
              </button>
            </form>
          )}

          {/* Demo Credentials */}
          <div className="mt-6 bg-muted rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Zap className="w-4 h-4 text-warning" />
              <span className="text-sm font-semibold">Demo Credentials — Click to autofill</span>
            </div>
            <div className="divide-y divide-border">
              {DEMO_CREDENTIALS.map((cred) => {
                const rc = ROLE_CONFIG[cred.role];
                return (
                  <div key={`cred-${cred.role}`} className="px-4 py-3 flex items-center gap-3 hover:bg-card/50 transition-colors">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${rc.bg}`}>
                      <rc.icon className={`w-3.5 h-3.5 ${rc.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{cred.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{cred.email}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(cred.email, `email-${cred.role}`)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy email"
                      >
                        {copiedField === `email-${cred.role}` ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => autofillCredentials(cred)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all duration-150 active:scale-95 ${rc.bg} ${rc.color}`}
                      >
                        Use
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}