import type { QuotaKey } from './constants';

export type TempleTrip = {
  id: string;
  date: string;
  registrationDeadline: string;
  dateConfirmed: boolean;
  includesTransport: boolean;
  includesLodging: boolean;
  includesBreakfast: boolean;
  includesLunch: boolean;
  quotaTransport: number;
  quotaLodging: number;
  costTransport: string;
  costBreakfast: string;
  costLunch: string;
  templeName: string;
  inAssignedDistrict: boolean;
  scheduledWithTemple: boolean;
  active: boolean;
  donationCategoryName: string | null;
  donationInstructions: string | null;
  createdAt: string;
  updatedAt: string;
} & Record<QuotaKey, number>;

export type TempleTripListItem = TempleTrip & {
  registeredCount: number;
  approvedCount: number;
  pendingCount: number;
};
