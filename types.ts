export enum UserRole {
  GUEST = 'GUEST',
  BUYER = 'BUYER',
  SELLER = 'SELLER',
}

export enum AuthStep {
  EMAIL_PASSWORD = 'EMAIL_PASSWORD',
  USERNAME = 'USERNAME',
  ROLE_CHECK = 'ROLE_CHECK',
  ADMIN_INPUT = 'ADMIN_INPUT',
  COMPLETE = 'COMPLETE',
}

export interface User {
  email: string;
  username: string;
  role: UserRole;
  avatar?: string;
}

export interface Product {
  id: string;
  sellerName: string;
  title: string;
  description: string;
  price: number;
  images: string[]; // Changed from imageUrl to support multiple images
  videoUrl?: string; // Optional video
}