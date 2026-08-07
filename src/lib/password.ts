export const PASSWORD_ERROR_MESSAGE =
  'Password must be at least 8 characters and contain an uppercase letter, a lowercase letter, a number, and a special character.';

export interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
    { id: 'upper', label: 'At least one uppercase letter', met: /[A-Z]/.test(password) },
    { id: 'lower', label: 'At least one lowercase letter', met: /[a-z]/.test(password) },
    { id: 'number', label: 'At least one number', met: /[0-9]/.test(password) },
    {
      id: 'special',
      label: 'At least one special character',
      met: /[^A-Za-z0-9\s]/.test(password),
    },
    { id: 'spaces', label: 'No spaces', met: password.length > 0 && !/\s/.test(password) },
  ];
}

export function isPasswordValid(password: string): boolean {
  return getPasswordRequirements(password).every((req) => req.met);
}
