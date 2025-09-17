import {
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS,
} from '@/constants/auth';

export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
}

export const validatePassword = (password: string): PasswordValidationResult => {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: PASSWORD_REQUIREMENTS };
  }

  if (!PASSWORD_COMPLEXITY_REGEX.test(password)) {
    return { valid: false, message: PASSWORD_REQUIREMENTS };
  }

  return { valid: true };
};
