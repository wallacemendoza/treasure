import type { MemberRank } from "../constants/ranks";

export interface Member {
  id: string;
  profile_id: string | null;

  full_name: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;

  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;

  photo_url: string | null;

  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;

  blood_type: string | null;

  member_rank: MemberRank;
  active: boolean;
  archived_at: string | null;

  birth_date: string | null;
  date_joined: string | null;
  notes: string | null;

  prior_balance_due: number;

  created_at: string;
  updated_at: string;
}