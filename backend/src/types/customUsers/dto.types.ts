export interface BaseUserDTO {
  id: string;
  username: string;
  avatar?: string;
  cover?: string;
  images?: string[];
  followers?: string[];
  following?: string[];
}

export interface AdminUserDTO extends BaseUserDTO {
  email: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUserDTO extends BaseUserDTO {}

