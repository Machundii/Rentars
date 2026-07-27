import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

const meta: Meta<typeof Modal> = {
  title: 'UI/Modal',
  component: Modal,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Modal>;

function ModalWithState({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Modal</Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Modal Dialog"
      >
        <ModalHeader title="Modal Dialog" onClose={() => setOpen(false)} />
        <ModalContent>
          <p className="text-gray-600">
            This is a modal dialog with proper focus management. Try these interactions:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>Press Tab to navigate between buttons</li>
            <li>Press Shift+Tab to navigate backwards</li>
            <li>Press Escape to close the modal</li>
            <li>Click outside the modal to close</li>
          </ul>
        </ModalContent>
        <ModalFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setOpen(false)}>
            Confirm
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}

export const Default: Story = {
  render: () => <ModalWithState defaultOpen={true} />,
};

export const WithTrigger: Story = {
  render: () => <ModalWithState defaultOpen={false} />,
};

export const LongContent: Story = {
  render: () => {
    const [open, setOpen] = useState(true);

    return (
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Modal with Long Content"
      >
        <ModalHeader title="Modal with Long Content" onClose={() => setOpen(false)} />
        <ModalContent>
          <p className="text-gray-600">
            This modal demonstrates scrolling within the modal when content is long.
          </p>
          {Array.from({ length: 10 }).map((_, i) => (
            <p key={i} className="text-sm text-gray-500">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
              incididunt ut labore et dolore magna aliqua.
            </p>
          ))}
        </ModalContent>
        <ModalFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    );
  },
};
