// ============================================================
// ТИПЫ ПРИЛОЖЕНИЯ RIDESHARE
// ============================================================

export type UserRole = 'passenger' | 'driver'

// ============================================================
// ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ
// ============================================================
export interface Profile {
  id: string
  phone: string
  full_name: string | null
  avatar_url: string | null
  rating_passenger: number
  rating_driver: number
  total_rides_as_passenger: number
  total_rides_as_driver: number
  is_verified: boolean
  is_blocked: boolean
  created_at: string
}

// ============================================================
// АВТОМОБИЛЬ
// ============================================================
export interface DriverVehicle {
  id: string
  driver_id: string
  brand: string
  model: string
  year: number
  color: string
  plate_number: string
  seats_count: number
  photo_url?: string | null
  is_verified: boolean
  is_active: boolean
}

// ============================================================
// СТАТУС ВОДИТЕЛЯ
// ============================================================
export interface DriverStatus {
  driver_id: string
  is_online: boolean
  lat: number | null
  lng: number | null
  last_seen: string
  vehicle_id: string | null
}

// ============================================================
// ПОЕЗДКИ
// ============================================================
export type RideStatus =
  | 'searching'
  | 'negotiating'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type RideType = 'city' | 'intercity'

export interface Ride {
  id: string
  passenger_id: string
  driver_id: string | null

  origin_address: string
  origin_lat: number
  origin_lng: number

  dest_address: string
  dest_lat: number
  dest_lng: number

  passenger_price: number
  final_price: number | null

  comment: string | null
  seats_needed: number
  allow_luggage: boolean
  allow_pets: boolean
  no_smoking: boolean
  ride_type: RideType

  status: RideStatus

  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  expires_at: string
  created_at: string
  updated_at: string

  // Joined data
  passenger?: Profile
  driver?: Profile
  offers?: RideOffer[]
}

// ============================================================
// ПРЕДЛОЖЕНИЯ (ТОРГ)
// ============================================================
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired'

export interface RideOffer {
  id: string
  ride_id: string
  driver_id: string
  offered_price: number
  message: string | null
  status: OfferStatus
  created_at: string

  // Joined
  driver?: Profile
  vehicle?: DriverVehicle
}

// ============================================================
// СООБЩЕНИЯ
// ============================================================
export interface RideMessage {
  id: string
  ride_id: string
  sender_id: string
  message: string
  is_read: boolean
  created_at: string

  sender?: Profile
}

// ============================================================
// ОТЗЫВЫ
// ============================================================
export interface Review {
  id: string
  ride_id: string
  reviewer_id: string
  reviewed_id: string
  role_reviewed: 'driver' | 'passenger'
  rating: number
  comment: string | null
  created_at: string
}

// ============================================================
// МАРКЕТ
// ============================================================
export interface MarketCategory {
  id: number
  slug: string
  name: string
  icon: string
  sort_order: number
}

export type PriceType = 'fixed' | 'negotiable' | 'free' | 'per_hour' | 'per_day'
export type ListingStatus = 'active' | 'inactive' | 'sold' | 'moderation'

export interface MarketListing {
  id: string
  author_id: string
  category_id: number

  title: string
  description: string | null
  price: number | null
  price_type: PriceType
  currency: string

  city: string | null
  address: string | null
  lat: number | null
  lng: number | null

  images: string[]

  contact_phone: string | null
  contact_name: string | null

  status: ListingStatus
  is_promoted: boolean
  promoted_until: string | null
  views_count: number

  expires_at: string
  created_at: string
  updated_at: string

  // Joined
  author?: Profile
  category?: MarketCategory
}

// ============================================================
// УВЕДОМЛЕНИЯ
// ============================================================
export type NotificationType =
  | 'new_offer'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'ride_started'
  | 'ride_completed'
  | 'ride_cancelled'
  | 'new_message'
  | 'review_received'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

// ============================================================
// СОХРАНЁННЫЕ МАРШРУТЫ
// ============================================================
export interface SavedRoute {
  id: string
  user_id: string
  name: string
  origin_address: string
  origin_lat: number | null
  origin_lng: number | null
  dest_address: string
  dest_lat: number | null
  dest_lng: number | null
  created_at: string
}

// ============================================================
// ДЛЯ ФОРМ
// ============================================================
export interface CreateRideForm {
  origin_address: string
  origin_lat: number
  origin_lng: number
  dest_address: string
  dest_lat: number
  dest_lng: number
  passenger_price: number
  seats_needed: number
  comment: string
  allow_luggage: boolean
  allow_pets: boolean
  no_smoking: boolean
  ride_type: RideType
  scheduled_at?: string
}

export interface CreateListingForm {
  category_id: number
  title: string
  description: string
  price: number | null
  price_type: PriceType
  city: string
  address: string
  contact_phone: string
  contact_name: string
  images: File[]
}

// ============================================================
// ОТВЕТЫ API
// ============================================================
export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface NearbyDriver {
  driver_id: string
  lat: number
  lng: number
  distance_km: number
  full_name: string
  rating_driver: number
  vehicle_id: string | null
}
