import type { Meta, StoryObj } from '@storybook/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Card>;

// ── Base ──────────────────────────────────────────────────────────────────────

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>A short description of this card.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">This is the card body content.</p>
      </CardContent>
    </Card>
  ),
};

// ── With footer ───────────────────────────────────────────────────────────────

export const WithFooter: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Booking Summary</CardTitle>
        <CardDescription>Review your booking details.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Check-in: Jan 10, 2025</p>
        <p className="text-sm">Check-out: Jan 15, 2025</p>
        <p className="text-sm font-semibold mt-2">Total: 600 USDC</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" className="flex-1">Cancel</Button>
        <Button className="flex-1">Confirm</Button>
      </CardFooter>
    </Card>
  ),
};

// ── Property card style ───────────────────────────────────────────────────────

export const PropertyStyle: Story = {
  render: () => (
    <Card className="w-72 overflow-hidden">
      <div className="h-40 bg-muted flex items-center justify-center text-muted-foreground text-sm">
        Property Image
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base truncate">Cozy Beach House</CardTitle>
          <Badge variant="secondary" className="shrink-0">Available</Badge>
        </div>
        <CardDescription>Miami, FL</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="font-bold text-primary">120 USDC <span className="text-xs font-normal text-muted-foreground">/ night</span></p>
      </CardContent>
    </Card>
  ),
};

// ── Header only ───────────────────────────────────────────────────────────────

export const HeaderOnly: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>You have 3 unread messages.</CardDescription>
      </CardHeader>
    </Card>
  ),
};

// ── Minimal / no padding customisation ───────────────────────────────────────

export const Minimal: Story = {
  render: () => (
    <Card className="w-80 p-4">
      <p className="text-sm">A minimal card with direct padding.</p>
    </Card>
  ),
};
