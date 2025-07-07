export interface Partner {
  id: string;
  name: string;
  logo: string;
  description: string;
  benefit: string;
  deeplink: string;
}

export interface PartnerClick {
  id: string;
  timestamp: Date;
  userId: string;
  partnerId: string;
  clickSource: 'card' | 'modal';
}

export interface PartnerStat {
  totalClicks: number;
  uniqueClicks: number;
  conversionRate: number;
  lastClickDate?: Date;
}