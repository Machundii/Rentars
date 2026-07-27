export interface FormattedBooking {
  id: string;
  propertyTitle: string;
  location: string;
  checkIn: Date;
  checkOut: Date;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  escrowStatus: 'locked' | 'released' | 'refunded';
}
