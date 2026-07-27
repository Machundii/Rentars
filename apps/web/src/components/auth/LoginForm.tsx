'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@/validations/auth.schema';
import { useState, useCallback } from 'react';
import { Mail, Lock, Loader } from 'lucide-react';
import { HCaptcha } from './HCaptcha';

interface LoginFormProps {
  onSubmit: (data: LoginInput & { captchaToken: string }) => Promise<void>;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [captchaError, setCaptchaError] = useState<string>('');

  const captchaEnabled = process.env.NEXT_PUBLIC_HCAPTCHA_ENABLED !== 'false'
    && !!process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onCaptchaVerify = useCallback((token: string) => {
    setCaptchaToken(token);
    setCaptchaError('');
  }, []);

  const onCaptchaExpire = useCallback(() => {
    setCaptchaToken('');
  }, []);

  const onSubmitHandler = async (data: LoginInput) => {
    if (captchaEnabled && !captchaToken) {
      setCaptchaError('Please complete the CAPTCHA challenge.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ ...data, captchaToken });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmitHandler)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            {...register('email')}
            type="email"
            placeholder="you@example.com"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            {...register('password')}
            type="password"
            placeholder="••••••••"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
      </div>

      <div>
        <HCaptcha onVerify={onCaptchaVerify} onExpire={onCaptchaExpire} />
        {captchaError && <p className="text-red-500 text-sm mt-1">{captchaError}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium flex items-center justify-center gap-2"
      >
        {isSubmitting && <Loader size={18} className="animate-spin" />}
        {isSubmitting ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
