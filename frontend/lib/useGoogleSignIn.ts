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
  const scriptLoadedRef = useRef(false);

  const handleGoogleResponse = useCallback(
    (response: { credential?: string }) => {
      if (response.credential) {
        onSuccess?.(response.credential);
      } else {
        onError?.('No credential received from Google');
      }
    },
    [onSuccess, onError]
  );

  const revoke = useCallback((email: string) => {
    return new Promise<void>((resolve, reject) => {
      if (typeof window !== 'undefined' && window.google?.accounts?.id) {
        window.google.accounts.id.revoke(email, (done) => {
          if (done.successful) {
            console.log('Google session revoked for:', email);
            // Also disable auto-select for future sessions
            window.google?.accounts.id.disableAutoSelect();
            resolve();
          } else {
            console.warn('Google session revocation failed:', done.error);
            // Still resolve because we want the UI to proceed
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }, []);

  useEffect(() => {
    if (!clientId) return;
    if (scriptLoadedRef.current && window.google) {
        // Even if script loaded, if we have a buttonId we might need to render it
        // But initializeGSI handles the check for window.google
    }
    
    const initializeGSI = () => {
      if (!window.google) return;

      // Only initialize if not already done globally
      if (!window.__GSI_INITIALIZED__) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
          ux_mode: 'popup',
          itp_support: true,
          use_fedcm_for_prompt: true,
          locale: locale || undefined,
        });
        window.__GSI_INITIALIZED__ = true;
      }

      if (buttonId) {
        const buttonDiv = document.getElementById(buttonId);
        if (buttonDiv) {
          const containerWidth = buttonDiv.parentElement?.clientWidth || 300;
          const buttonWidth = Math.max(200, Math.min(400, Math.floor(containerWidth)));

          window.google.accounts.id.renderButton(buttonDiv, {
            theme: 'outline',
            size: 'large',
            width: buttonWidth,
            text: buttonText,
            shape: 'pill',
          });
        }
      }
    };

    if (scriptLoadedRef.current) {
        initializeGSI();
        return;
    }
    scriptLoadedRef.current = true;

    // Check if script already exists
    if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      if (window.google) {
        initializeGSI();
      } else {
        // Script is there but google object not yet ready
        const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]') as HTMLScriptElement;
        const existingOnload = script.onload;
        script.onload = (e) => {
          if (existingOnload) (existingOnload as any)(e);
          initializeGSI();
        };
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGSI;
    script.onerror = () => {
      console.warn('Failed to load Google Sign-In script');
      onError?.('Failed to load Google Sign-In script');
    };

    document.body.appendChild(script);

    return () => {
        // Cleanup if necessary
    };
  }, [clientId, handleGoogleResponse, buttonId, buttonText, onError]);

  return { revoke };
}
