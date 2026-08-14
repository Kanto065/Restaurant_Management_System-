export type DayOfWeekName = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export interface OpeningHour {
  dayOfWeek: DayOfWeekName; // serialized as the .NET DayOfWeek enum name, not its numeric value
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
}

export interface OpeningHourException {
  date: string;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
  note: string | null;
}

export interface HeroSlide {
  imageUrl: string;
  heading: string;
  subheading: string | null;
}

export interface HomepageContent {
  heroSlides: HeroSlide[];
  orderOnlineTitle: string | null;
  orderOnlineText: string | null;
  loyaltyTitle: string | null;
  loyaltyText: string | null;
  deliverTitle: string | null;
  deliverText: string | null;
  welcomeTitle: string | null;
  welcomeText: string | null;
}

export interface RestaurantPublic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  themeColorPrimary: string;
  themeColorSecondary: string;
  phone: string | null;
  email: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postcode: string;
  supportsDelivery: boolean;
  supportsCollection: boolean;
  supportsDineIn: boolean;
  processingFeeFlat: number;
  processingFeePercentage: number;
  loyaltyPointsPerCurrencyUnit: number;
  currency: string;
  homepageContent: HomepageContent | null;
  openingHours: OpeningHour[];
  openingHourExceptions: OpeningHourException[];
}

export interface Review {
  id: string;
  authorName: string;
  authorLocation: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface ReviewPage {
  reviews: Review[];
  page: number;
  pageSize: number;
  totalCount: number;
  averageRating: number;
}

export interface DeliveryZone {
  id: string;
  name: string;
  maxMileage: number;
  deliveryFee: number;
  minimumOrderAmount: number;
}

export type SpiceLevel = 'None' | 'Mild' | 'Medium' | 'Hot';

export interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  isVegetarian: boolean;
  isVegan: boolean;
  isBestSeller: boolean;
  spiceLevel: SpiceLevel;
  preparationTimeMinutes: number;
  modifierGroups: ModifierGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  items: MenuItem[];
}

export interface Deal {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  components: { menuItemId: string | null; categoryId: string | null; quantity: number }[];
}

export interface MenuResponse {
  categories: MenuCategory[];
  deals: Deal[];
}

export type OrderType = 'DineIn' | 'Collection' | 'Delivery';
export type PaymentMethod = 'Card' | 'Cash' | 'ApplePay' | 'GooglePay';
export type OrderStatus =
  | 'Pending' | 'Confirmed' | 'Preparing' | 'Ready'
  | 'OutForDeliveryOrServed' | 'Completed' | 'Cancelled';

export interface CreateOrderItem {
  menuItemId: string;
  quantity: number;
  selectedModifierOptionIds: string[];
  specialInstructions?: string | null;
}

export interface CreateOrderAddress {
  line1: string;
  line2?: string | null;
  city: string;
  postcode: string;
}

export interface CreateOrderRequest {
  orderType: OrderType;
  tableQrToken?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  deliveryAddress?: CreateOrderAddress | null;
  items: CreateOrderItem[];
  specialRequests?: string | null;
  paymentMethod: PaymentMethod;
  voucherCode?: string | null;
}

export interface CreatedOrder {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  processingFee: number;
  discountAmount: number;
  totalAmount: number;
  loyaltyPointsEarned: number;
}

export interface TrackOrder {
  id: string;
  orderNumber: number;
  orderType: OrderType;
  status: OrderStatus;
  paymentStatus: string;
  totalAmount: number;
  estimatedReadyAt: string | null;
  createdAt: string;
  items: { nameSnapshot: string; quantity: number; lineTotal: number }[];
}
