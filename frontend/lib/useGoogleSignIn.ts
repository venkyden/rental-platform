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
    if (!clientId) return;

    // Install a stable trampoline on the window once. All GSI credentials are
    // routed through it, so the latest onSuccess/onError is always called
    // regardless of which page initialized GSI.
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
      if (!buttonId || !window.google) return;
      const buttonDiv = document.getElementById(buttonId);
      if (!buttonDiv) return;
      const containerWidth = buttonDiv.parentElement?.clientWidth || 300;
      const buttonWidth = Math.max(200, Math.min(400, Math.floor(containerWidth)));
      window.google.accounts.id.renderButton(buttonDiv, {
        theme: 'outline',
        size: 'large',
        width: buttonWidth,
        text: buttonText,
        shape: 'pill',
      });
    };

    const initializeGSI = () => {
      if (!window.google) return;

      if (!window.__GSI_INITIALIZED__) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          // Route all credentials through the stable trampoline.
          callback: (response: { credential?: string }) => window.__GSI_CALLBACK__?.(response),
          auto_select: false,
          cancel_on_tap_outside: true,
          ux_mode: 'popup',
          itp_support: true,
          use_fedcm_for_prompt: true,
          locale: locale || undefined,
        });
        window.__GSI_INITIALIZED__ = true;
      }

      renderButton();
    };

    if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      if (window.google) {
        initializeGSI();
      } else {
        const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]') as HTMLScriptElement;
        const existingOnload = script.onload;
        script.onload = (e) => {
          if (existingOnload) (existingOnload as EventListener)(e as Event);
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
      onErrorRef.current?.('Failed to load Google Sign-In script');
    };
    document.body.appendChild(script);
  }, [clientId, buttonId, buttonText, locale]);

  return { revoke };
}
