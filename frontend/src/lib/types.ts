export type UserRole = "admin" | "customer";

export type ShipmentStatus = "pending" | "in_transit" | "delivered" | "failed";

export type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

export type AddressDetails = {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
};

export type PackageDetails = {
  weightLb: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  description: string;
};

export type TrackingLog = {
  id: number;
  shipment_id: number;
  status: string;
  location: string;
  timestamp: string;
  raw_response: Record<string, unknown>;
};

export type Shipment = {
  id: number;
  user_id: number;
  tracking_number: string;
  sender_details: AddressDetails;
  receiver_details: AddressDetails;
  package_details: PackageDetails;
  status: ShipmentStatus;
  label_url: string | null;
  fedex_response: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  /** Present when loaded from API detail/list with logs */
  tracking_logs?: TrackingLog[];
};

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

export type UpdateUserInput = Partial<Omit<CreateUserInput, "password">> & {
  password?: string;
};

export type CreateShipmentInput = {
  /** Ignored for customer API (owner is authenticated user). */
  user_id?: number;
  sender_details: AddressDetails;
  receiver_details: AddressDetails;
  package_details: PackageDetails;
};
