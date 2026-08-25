'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  closeButton?: React.ReactNode;
}

export const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  ({ open, onOpenChange, title, children, closeButton, className, ...props }, ref) => {
    const dialogRef = React.useRef<HTMLDivElement>(null);
    const previousActiveElement = React.useRef<HTMLElement | null>(null);

    React.useEffect(() => {
      if (!open) return;

      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Get all focusable elements within the modal
      const dialogElement = dialogRef.current;
      if (!dialogElement) return;

      const focusableElements = dialogElement.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      // Focus the first focusable element
      if (firstElement) {
        firstElement.focus();
      }

      // Handle keyboard events
      const handleKeyDown = (e: KeyboardEvent) => {
        // Close on Escape
        if (e.key === 'Escape') {
          onOpenChange(false);
          return;
        }

        // Focus trap for Tab key
        if (e.key === 'Tab' && (firstElement || lastElement)) {
          if (e.shiftKey) {
            // Shift+Tab
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement?.focus();
            }
          } else {
            // Tab
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement?.focus();
            }
          }
        }
      };

      dialogElement.addEventListener('keydown', handleKeyDown);

      // Make background inert
      const body = document.body;
      const originalOverflow = body.style.overflow;
      body.style.overflow = 'hidden';

      return () => {
        dialogElement.removeEventListener('keydown', handleKeyDown);
        body.style.overflow = originalOverflow;
      };
    }, [open, onOpenChange]);

    React.useEffect(() => {
      if (!open && previousActiveElement.current) {
        // The trigger element may have been removed from the DOM between
        // the time the modal opened and when it closed. Calling focus() on
        // a detached element can throw or leave focus in an undefined state,
        // so we guard with isConnected before attempting restoration.
        if (previousActiveElement.current.isConnected) {
          previousActiveElement.current.focus();
        }
        previousActiveElement.current = null;
      }
    }, [open]);

    if (!open) return null;

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => onOpenChange(false)}
          role="presentation"
          aria-hidden="true"
        />

        {/* Modal Dialog */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center p-4',
            className
          )}
          {...props}
        >
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            {children}
          </div>
        </div>
      </>
    );
  }
);

Modal.displayName = 'Modal';

interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  onClose?: () => void;
}

export const ModalHeader = React.forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ title, onClose, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center justify-between p-6 border-b', className)}
      {...props}
    >
      <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
        {title}
      </h2>
      {onClose && (
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition p-1"
          aria-label="Close modal"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  )
);

ModalHeader.displayName = 'ModalHeader';

interface ModalContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('p-6 space-y-4', className)}
      {...props}
    />
  )
);

ModalContent.displayName = 'ModalContent';

interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ModalFooter = React.forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex gap-3 p-6 border-t', className)}
      {...props}
    />
  )
);

ModalFooter.displayName = 'ModalFooter';
