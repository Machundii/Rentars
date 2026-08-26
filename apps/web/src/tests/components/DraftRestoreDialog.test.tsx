import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DraftRestoreDialog from '@/components/properties/ListingForm/DraftRestoreDialog';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderDialog(overrides: {
  hasDraft?: boolean;
  onResume?: () => void;
  onDiscard?: () => void;
  onDismiss?: () => void;
  isOpen?: boolean;
} = {}) {
  const props = {
    hasDraft: true,
    onResume: vi.fn(),
    onDiscard: vi.fn(),
    onDismiss: vi.fn(),
    isOpen: true,
    ...overrides,
  };
  render(<DraftRestoreDialog {...props} />);
  return props;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('DraftRestoreDialog — rendering', () => {
  it('renders when hasDraft and isOpen are true', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/resume draft/i)).toBeInTheDocument();
  });

  it('does not render when hasDraft is false', () => {
    renderDialog({ hasDraft: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    renderDialog({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ── Explicit discard removes draft ───────────────────────────────────────────

describe('DraftRestoreDialog — explicit discard', () => {
  it('calls onDiscard when the Discard button is clicked', async () => {
    const user = userEvent.setup();
    const { onDiscard, onDismiss } = renderDialog();

    await user.click(screen.getByRole('button', { name: /discard/i }));

    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('calls onResume when the Resume button is clicked', async () => {
    const user = userEvent.setup();
    const { onResume, onDiscard, onDismiss } = renderDialog();

    await user.click(screen.getByRole('button', { name: /resume/i }));

    expect(onResume).toHaveBeenCalledOnce();
    expect(onDiscard).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

// ── Dismissal preserves draft ────────────────────────────────────────────────

describe('DraftRestoreDialog — dismissal preserves draft', () => {
  it('calls onDismiss (not onDiscard) when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const { onDiscard, onDismiss } = renderDialog();

    const backdrop = document.querySelector('[role="presentation"]') as HTMLElement;
    await user.click(backdrop);

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('calls onDismiss (not onDiscard) when Escape is pressed', async () => {
    const user = userEvent.setup();
    const { onDiscard, onDismiss } = renderDialog();

    await user.keyboard('{Escape}');

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('clicking inside the dialog card does not dismiss or discard', async () => {
    const user = userEvent.setup();
    const { onDiscard, onDismiss } = renderDialog();

    // Click on the heading text inside the dialog
    await user.click(screen.getByRole('dialog'));

    expect(onDismiss).not.toHaveBeenCalled();
    expect(onDiscard).not.toHaveBeenCalled();
  });
});

// ── Cancel then reopen still sees the draft ──────────────────────────────────

describe('DraftRestoreDialog — cancel preserves draft across reopen', () => {
  it('still shows the dialog after dismiss and reopen', async () => {
    const user = userEvent.setup();
    let isOpen = true;
    const onDismiss = vi.fn(() => {
      isOpen = false;
    });
    const onDiscard = vi.fn();
    const onResume = vi.fn();

    const { rerender } = render(
      <DraftRestoreDialog
        hasDraft={true}
        onResume={onResume}
        onDiscard={onDiscard}
        onDismiss={onDismiss}
        isOpen={isOpen}
      />
    );

    // Dismiss via backdrop
    const backdrop = document.querySelector('[role="presentation"]') as HTMLElement;
    await user.click(backdrop);

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onDiscard).not.toHaveBeenCalled();

    // Re-render with isOpen = false (simulates parent hiding the dialog on dismiss)
    rerender(
      <DraftRestoreDialog
        hasDraft={true}
        onResume={onResume}
        onDiscard={onDiscard}
        onDismiss={onDismiss}
        isOpen={false}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Reopen — hasDraft is still true (draft was NOT discarded)
    rerender(
      <DraftRestoreDialog
        hasDraft={true}
        onResume={onResume}
        onDiscard={onDiscard}
        onDismiss={onDismiss}
        isOpen={true}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
