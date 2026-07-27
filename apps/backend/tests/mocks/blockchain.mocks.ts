/**
 * Blockchain service mocks — using bun:test mock API.
 */

import { mock } from 'bun:test';

export const mockBlockchainServices = {
  checkAvailability: mock(async () => true),
  createBookingOnChain: mock(async () => BigInt(1)),
  cancelBookingOnChain: mock(async () => undefined),
  updateBookingStatusOnChain: mock(async () => undefined),
  listPropertyOnChain: mock(async () => BigInt(1)),
  getPropertyOnChain: mock(async () => ({
    id: BigInt(1),
    owner: 'GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFSNHERX3LRJCX5FWCL46664F3',
    title: 'Test Property',
    pricePerNight: BigInt(100),
  })),
};

export function resetBlockchainMocks() {
  for (const m of Object.values(mockBlockchainServices)) {
    m.mockClear();
  }
}
