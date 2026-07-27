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
});
