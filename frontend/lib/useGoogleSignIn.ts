import { useEffect, useRef, useCallback } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
          prompt: () => void;
          cancel: () => void;
          revoke: (email: string, callback: (done: { successful: boolean; error: string }) => void) => void;
          disableAutoSelect: () => void;
        };
      };
    };
    // Stable trampoline: always calls the latest onSuccess/onError without re-initializing GSI
    __GSI_CALLBACK__?: (response: { credential?: string }) => void;
    __GSI_INITIALIZED__?: boolean;
  }
}

interface UseGoogleSignInOptions {
  clientId: string | undefined;
  onSuccess?: (credential: string) => void;
  onError?: (error: string) => void;
  buttonId?: string;
  buttonText?: 'signin_with' | 'signup_with';
  locale?: string;
}

export function useGoogleSignIn({
  clientId,
  onSuccess,
  onError,
  buttonId,
  buttonText = 'signin_with',
  locale,
}: UseGoogleSignInOptions = { clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID }) {
  // Keep the latest callbacks in refs so the stable GSI trampoline always
  // calls the current handler without requiring re-initialization.
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const revoke = useCallback((email: string) => {
    return new Promise<void>((resolve) => {
      if (typeof window !== 'undefined' && window.google?.accounts?.id) {
        window.google.accounts.id.revoke(email, (done) => {
          if (!done.successful) {
            console.warn('Google session revocation failed:', done.error);
          }
          window.google?.accounts.id.disableAutoSelect();
          resolve();
        });
      } else {
        resolve();
      }
    });
  }, []);

  useEffect(() => {
    if (!clientId) {
      console.error('[useGoogleSignIn] Missing Google Client ID. Button will not render.');
      return;
    }

    if (!window.__GSI_CALLBACK__) {
      window.__GSI_CALLBACK__ = (response: { credential?: string }) => {
        if (response.credential) {
          onSuccessRef.current?.(response.credential);
        } else {
          onErrorRef.current?.('No credential received from Google');
        }
      };
    }

    const renderButton = () => {
      // Some consumers only need revoke() and never pass a buttonId — that's
      // intentional, not an error.
      if (!buttonId || !window.google) {
        return;
      }

      const buttonDiv = document.getElementById(buttonId);
      if (!buttonDiv) {
        console.error('[useGoogleSignIn] Cannot find DOM element with id:', buttonId);
        return;
      }

      const containerWidth = buttonDiv.parentElement?.clientWidth || 300;
      const buttonWidth = Math.max(200, Math.min(400, Math.floor(containerWidth)));

      try {
        window.google.accounts.id.renderButton(buttonDiv, {
          theme: 'outline',
          size: 'large',
          width: buttonWidth,
          text: buttonText,
          shape: 'pill',
        });
      } catch (err) {
        console.error('[useGoogleSignIn] Error rendering button:', err);
      }
    };

    const initializeGSI = () => {
      if (!window.google) {
        console.error('[useGoogleSignIn] window.google is undefined during initializeGSI');
        return;
      }

      if (!window.__GSI_INITIALIZED__) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: { credential?: string }) => window.__GSI_CALLBACK__?.(response),
            auto_select: false,
            cancel_on_tap_outside: true,
            ux_mode: 'popup',
            itp_support: true,
            use_fedcm_for_prompt: true,
            locale: locale || undefined,
          });
          window.__GSI_INITIALIZED__ = true;
        } catch (err) {
          console.error('[useGoogleSignIn] Error initializing GSI:', err);
        }
      }

      renderButton();
    };

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      if (window.google) {
        initializeGSI();
      } else {
        existingScript.addEventListener('load', initializeGSI);
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', initializeGSI);
    script.addEventListener('error', () => {
      console.error('[useGoogleSignIn] Failed to load Google Sign-In script');
      onErrorRef.current?.('Failed to load Google Sign-In script');
    });
    document.body.appendChild(script);
  }, [clientId, buttonId, buttonText, locale]);

  return { revoke };
}

