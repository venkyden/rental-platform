/**
 * Shared client-side input validation.
 *
 * Client validation is a UX layer only — it gives instant feedback and avoids
 * pointless network round-trips. The backend (Pydantic + DB constraints) remains
 * the source of truth and re-validates everything.
 */

// Pragmatic email shape check (matches the register page's existing rule).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
    return EMAIL_RE.test(email.trim());
}

/** Mirrors the backend password policy (UserRegister / ResetPasswordRequest). */
export function passwordIssues(password: string): {
    minLength: boolean;
    upper: boolean;
    lower: boolean;
    digit: boolean;
    special: boolean;
} {
    return {
        minLength: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        digit: /\d/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
}

export function isStrongPassword(password: string): boolean {
    return Object.values(passwordIssues(password)).every(Boolean);
}
