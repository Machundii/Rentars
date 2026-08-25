import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/tests/utils/test-utils';
import { Modal, ModalHeader, ModalContent } from '../modal';

describe('Modal', () => {
  it('renders when open is true', () => {
    render(
      <Modal open={true} onOpenChange={vi.fn()} title="Test Modal">
        <ModalContent>Test content</ModalContent>
      </Modal>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(
      <Modal open={false} onOpenChange={vi.fn()} title="Test Modal">
        <ModalContent>Test content</ModalContent>
      </Modal>
    );

    expect(screen.queryByText('Test content')).not.toBeInTheDocument();
  });

  it('has proper ARIA attributes', () => {
    render(
      <Modal open={true} onOpenChange={vi.fn()} title="Test Modal">
        <ModalContent>Test content</ModalContent>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
  });

  it('closes on Escape key', async () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open={true} onOpenChange={onOpenChange} title="Test Modal">
        <ModalContent>Test content</ModalContent>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('closes when backdrop is clicked', () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open={true} onOpenChange={onOpenChange} title="Test Modal">
        <ModalContent>Test content</ModalContent>
      </Modal>
    );

    const backdrop = document.querySelector('[role="presentation"]');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('traps focus within the modal', async () => {
    render(
      <Modal open={true} onOpenChange={vi.fn()} title="Test Modal">
        <ModalContent>
          <button>Button 1</button>
          <button>Button 2</button>
        </ModalContent>
      </Modal>
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);

    // Tab should not move focus outside modal
    const firstButton = buttons[0];
    firstButton.focus();
    expect(document.activeElement).toBe(firstButton);
  });

  it('renders with proper header structure', () => {
    render(
      <Modal open={true} onOpenChange={vi.fn()} title="Test Modal">
        <ModalHeader title="Test Modal" onClose={vi.fn()} />
        <ModalContent>Test content</ModalContent>
      </Modal>
    );

    const heading = screen.getByText('Test Modal');
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveAttribute('id', 'modal-title');
  });

  it('renders close button with proper aria label', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onOpenChange={vi.fn()} title="Test Modal">
        <ModalHeader title="Test Modal" onClose={onClose} />
        <ModalContent>Test content</ModalContent>
      </Modal>
    );

    const closeButton = screen.getByLabelText('Close modal');
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('restores focus to the trigger element when the modal closes normally', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open Modal';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = render(
      <Modal open={true} onOpenChange={vi.fn()} title="Focus Test">
        <ModalContent>Content</ModalContent>
      </Modal>
    );

    // Close the modal
    rerender(
      <Modal open={false} onOpenChange={vi.fn()} title="Focus Test">
        <ModalContent>Content</ModalContent>
      </Modal>
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });

    document.body.removeChild(trigger);
  });

  it('does not throw and does not restore focus when the trigger has been removed before close', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open Modal';
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <Modal open={true} onOpenChange={vi.fn()} title="Removed Trigger Test">
        <ModalContent>Content</ModalContent>
      </Modal>
    );

    // Remove the trigger from the DOM before closing — simulates a
    // dynamically rendered trigger that unmounts while the modal is open
    document.body.removeChild(trigger);

    // Closing must not throw
    expect(() => {
      rerender(
        <Modal open={false} onOpenChange={vi.fn()} title="Removed Trigger Test">
          <ModalContent>Content</ModalContent>
        </Modal>
      );
    }).not.toThrow();

    // Focus should not have moved to the detached element
    await waitFor(() => {
      expect(document.activeElement).not.toBe(trigger);
    });
  });

  it('escape and backdrop close behaviour remain unchanged after the focus-guard change', async () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open={true} onOpenChange={onOpenChange} title="Behaviour Test">
        <ModalContent>Content</ModalContent>
      </Modal>
    );

    // Escape closes
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    onOpenChange.mockClear();

    // Backdrop closes
    const backdrop = document.querySelector('[role="presentation"]');
    if (backdrop) fireEvent.click(backdrop);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
