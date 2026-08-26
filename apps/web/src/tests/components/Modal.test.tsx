import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/modal';

// Helper: renders a controlled Modal with a button inside it
function ModalFixture({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Test Modal">
      <ModalHeader title="Test Modal" onClose={() => onOpenChange(false)} />
      <ModalContent>
        <button>First button</button>
        <button>Second button</button>
      </ModalContent>
      <ModalFooter>
        <button>Footer button</button>
      </ModalFooter>
    </Modal>
  );
}

afterEach(() => {
  // Restore body overflow in case a test fails mid-way
  document.body.style.overflow = '';
});

// ── Focus management ──────────────────────────────────────────────────────────

describe('Modal — focus management', () => {
  it('moves focus inside the modal when it opens', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<ModalFixture open={false} onOpenChange={onOpenChange} />);

    // Modal is closed — nothing inside it should be in the DOM
    expect(screen.queryByText('First button')).not.toBeInTheDocument();

    // Open the modal
    rerender(<ModalFixture open={true} onOpenChange={onOpenChange} />);

    // After opening, focus must be inside the dialog
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('focuses the first focusable element inside the modal', () => {
    const onOpenChange = vi.fn();
    render(<ModalFixture open={true} onOpenChange={onOpenChange} />);

    // The close button in ModalHeader is the first focusable element
    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('focuses the dialog container itself when there are no focusable children', () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open={true} onOpenChange={onOpenChange} title="Empty Modal">
        {/* No interactive elements */}
        <p>No buttons here</p>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('restores focus to the previously focused element after closing', async () => {
    const onOpenChange = vi.fn();

    // Render a button outside the modal and focus it
    const { rerender } = render(
      <div>
        <button id="trigger">Open Modal</button>
        <ModalFixture open={false} onOpenChange={onOpenChange} />
      </div>
    );

    const triggerBtn = document.getElementById('trigger') as HTMLButtonElement;
    triggerBtn.focus();
    expect(document.activeElement).toBe(triggerBtn);

    // Open modal
    rerender(
      <div>
        <button id="trigger">Open Modal</button>
        <ModalFixture open={true} onOpenChange={onOpenChange} />
      </div>
    );

    // Close modal
    rerender(
      <div>
        <button id="trigger">Open Modal</button>
        <ModalFixture open={false} onOpenChange={onOpenChange} />
      </div>
    );

    // Focus should return to the trigger button
    expect(document.activeElement).toBe(triggerBtn);
  });
});

// ── Focus trap ────────────────────────────────────────────────────────────────

describe('Modal — focus trap', () => {
  it('keeps focus inside the modal on Tab', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ModalFixture open={true} onOpenChange={onOpenChange} />);

    const buttons = screen.getAllByRole('button');
    // Tab through all focusable elements — after the last one, focus wraps to first
    for (let i = 0; i < buttons.length + 1; i++) {
      await user.tab();
    }
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ModalFixture open={true} onOpenChange={onOpenChange} />);

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ── Mouse interactions remain unchanged ──────────────────────────────────────

describe('Modal — mouse interactions', () => {
  it('closes when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ModalFixture open={true} onOpenChange={onOpenChange} />);

    // The backdrop is the first fixed div with role="presentation"
    const backdrop = document.querySelector('[role="presentation"]') as HTMLElement;
    await user.click(backdrop);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not close when clicking inside the modal content', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ModalFixture open={true} onOpenChange={onOpenChange} />);

    await user.click(screen.getByText('First button'));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
