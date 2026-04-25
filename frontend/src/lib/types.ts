export type UserRole = "admin" | "customer";

export type ShipmentStatus =
  | "pending"
  | "in_transit"
  | "delivered"
  | "failed"
  | "label_created"
  | "cancelled";

export type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  address_street?: string | null;
  address_street2?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_postal_code?: string | null;
  address_country?: string | null;
  address_company?: string | null;
  address_saved?: boolean;
  address_fedex_verified?: boolean;
  address_saved_at?: string | null;
  address_verified_at?: string | null;
  has_address?: boolean;
};

export type UserProfile = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  address_street: string | null;
  address_street2: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  address_country: string;
  address_company: string | null;
  address_saved: boolean;
  address_fedex_verified: boolean;
  address_saved_at: string | null;
  address_verified_at: string | null;
  has_address: boolean;
};

export type ProfileFormData = {
  name: string;
  phone: string;
  company: string;
  street: string;
  street2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
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
  email?: string;
};

/** System ship-to; server overrides FedEx `recipients` with this. */
export type FixedRecipient = {
  personName: string;
  companyName: string;
  phoneNumber: string;
  email: string;
  address: {
    streetLines: string[];
    city: string;
    stateOrProvinceCode: string;
    postalCode: string;
    countryCode: string;
    residential: boolean;
  };
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
  fedex_tracking_number?: string | null;
  sender_details: AddressDetails;
  receiver_details: AddressDetails;
  package_details: PackageDetails;
  status: ShipmentStatus;
  label_url: string | null;
  label_path?: string | null;
  service_type?: string | null;
  pickup_type?: string | null;
  package_weight?: number | null;
  package_dimensions?: {
    length: number;
    width: number;
    height: number;
    units: "IN" | "CM";
  } | null;
  is_residential?: boolean;
  fedex_transaction_id?: string | null;
  fedex_job_id?: string | null;
  shipped_at?: string | null;
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

/** Admin create: `POST /api/admin/shipments` (FedEx Ship when configured) */
export type CreateAdminShipmentInput = {
  user_id: number;
  sender_details: AddressDetails;
  receiver_details: AddressDetails;
  package_details: PackageDetails;
};

/** Admin update: `PATCH /api/admin/shipments/{id}` */
export type UpdateAdminShipmentInput = {
  user_id?: number;
  status?: ShipmentStatus;
};
